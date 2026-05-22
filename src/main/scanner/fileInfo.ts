import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import { FileInfo, SignatureInfo } from '../../shared/types'

const execAsync = promisify(exec)

// 文件信息缓存
const fileInfoCache = new Map<string, FileInfo>()

/**
 * 文件元数据提取和数字签名验证模块
 */
export class FileInfoExtractor {
  /**
   * 获取文件完整信息
   * @param filePath 文件路径
   * @param useCache 是否使用缓存
   */
  async getFileInfo(filePath: string, useCache: boolean = true): Promise<FileInfo | null> {
    // 检查缓存
    if (useCache) {
      const cached = fileInfoCache.get(filePath)
      if (cached) {
        console.log(`[FileInfoExtractor] 使用缓存的文件信息: ${filePath}`)
        return cached
      }
    }

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.warn(`[FileInfoExtractor] 文件不存在: ${filePath}`)
        return null
      }

      console.log(`[FileInfoExtractor] 开始提取文件信息: ${filePath}`)

      // 并行提取各项信息
      const [basicInfo, versionInfo, signatureInfo, hashes] = await Promise.all([
        this.getBasicInfo(filePath),
        this.getVersionInfo(filePath),
        this.getSignatureInfo(filePath),
        this.calculateHashes(filePath)
      ])

      const fileInfo: FileInfo = {
        ...basicInfo,
        ...versionInfo,
        signature: signatureInfo,
        ...hashes
      }

      // 缓存结果
      fileInfoCache.set(filePath, fileInfo)
      console.log(`[FileInfoExtractor] 文件信息提取完成: ${filePath}`)

      return fileInfo
    } catch (error) {
      console.error(`[FileInfoExtractor] 提取文件信息失败: ${filePath}`, error)
      return null
    }
  }

  /**
   * 获取文件基本信息
   */
  private async getBasicInfo(filePath: string): Promise<{
    filePath: string
    fileSize: number
    createTime: Date
    modifyTime: Date
  }> {
    const stat = fs.statSync(filePath)

    return {
      filePath,
      fileSize: stat.size,
      createTime: stat.birthtime,
      modifyTime: stat.mtime
    }
  }

  /**
   * 获取版本信息（使用 PowerShell）
   */
  private async getVersionInfo(filePath: string): Promise<{
    version: string
    description: string
    company: string
  }> {
    try {
      const psScript = `
        $file = Get-Item "${filePath}"
        $versionInfo = $file.VersionInfo
        [PSCustomObject]@{
          FileVersion = $versionInfo.FileVersion
          ProductName = $versionInfo.ProductName
          CompanyName = $versionInfo.CompanyName
          FileDescription = $versionInfo.FileDescription
        } | ConvertTo-Json
      `

      const { stdout } = await execAsync(`powershell -Command "${psScript}"`, {
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024
      })

      if (!stdout || stdout.trim().length === 0) {
        return { version: '', description: '', company: '' }
      }

      const info = JSON.parse(stdout)

      return {
        version: info.FileVersion || '',
        description: info.FileDescription || '',
        company: info.CompanyName || ''
      }
    } catch (error) {
      console.warn('[FileInfoExtractor] 获取版本信息失败:', error)
      return { version: '', description: '', company: '' }
    }
  }

  /**
   * 获取数字签名信息
   */
  private async getSignatureInfo(filePath: string): Promise<SignatureInfo> {
    try {
      const psScript = `
        $signature = Get-AuthenticodeSignature "${filePath}"
        if ($signature.Status -eq 'Valid') {
          [PSCustomObject]@{
            Status = 'valid'
            SignerName = $signature.SignerCertificate.Subject
            IssuerName = $signature.SignerCertificate.Issuer
            SignedAt = $signature.TimeStampRequest.Time.ToString('o')
          } | ConvertTo-Json
        } else {
          [PSCustomObject]@{
            Status = 'invalid'
            SignerName = ''
            IssuerName = ''
            SignedAt = ''
          } | ConvertTo-Json
        }
      `

      const { stdout } = await execAsync(`powershell -Command "${psScript}"`, {
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024
      })

      if (!stdout || stdout.trim().length === 0) {
        return { status: 'unsigned' }
      }

      const sigInfo = JSON.parse(stdout)

      return {
        status: sigInfo.Status as 'valid' | 'invalid' | 'unsigned',
        signerName: sigInfo.SignerName,
        issuerName: sigInfo.IssuerName,
        signedAt: sigInfo.SignedAt ? new Date(sigInfo.SignedAt) : undefined
      }
    } catch (error) {
      console.warn('[FileInfoExtractor] 获取签名信息失败:', error)
      return { status: 'unsigned' }
    }
  }

  /**
   * 计算文件哈希
   */
  private async calculateHashes(filePath: string): Promise<{
    md5: string
    sha256: string
  }> {
    return new Promise((resolve, reject) => {
      try {
        const fileBuffer = fs.readFileSync(filePath)
        
        const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex')
        const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')

        resolve({ md5, sha256 })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    fileInfoCache.clear()
    console.log('[FileInfoExtractor] 缓存已清除')
  }

  /**
   * 从缓存获取文件信息
   */
  getCachedInfo(filePath: string): FileInfo | undefined {
    return fileInfoCache.get(filePath)
  }
}

/**
 * 导出单例实例
 */
export const fileInfoExtractor = new FileInfoExtractor()
