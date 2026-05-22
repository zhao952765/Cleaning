import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import { FileInfo, SignatureInfo } from '../../shared/types'

const execAsync = promisify(exec)

// 文件信息缓存
const fileInfoCache = new Map<string, FileInfo>()

// ============================================================
// 简单并发限制器（替代 p-limit）
// ============================================================
class ConcurrencyLimiter {
  private queue: Array<() => void> = []
  private active = 0
  constructor(private limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>(resolve => this.queue.push(resolve))
    }
    this.active++
    try {
      return await fn()
    } finally {
      this.active--
      if (this.queue.length > 0) {
        const next = this.queue.shift()!
        next()
      }
    }
  }
}

// 全局并发限制器：最大 6 个并发哈希计算
const hashLimiter = new ConcurrencyLimiter(6)

// 大文件阈值：50MB
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024
// 大文件时读取的头部和尾部大小：1MB
const CHUNK_SIZE = 1 * 1024 * 1024

/**
 * 文件元数据提取和数字签名验证模块（性能优化版）
 */
export class FileInfoExtractor {
  /**
   * 获取文件完整信息
   */
  async getFileInfo(filePath: string, useCache: boolean = true): Promise<FileInfo | null> {
    // 检查缓存
    if (useCache) {
      const cached = fileInfoCache.get(filePath)
      if (cached) {
        console.log(`[FileInfoExtractor] 使用缓存: ${filePath}`)
        return cached
      }
    }

    // 文件存在性检查 + 访问权限检查
    try {
      await fs.promises.access(filePath, fs.constants.R_OK)
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.warn(`[FileInfoExtractor] 文件不存在: ${filePath}`)
      } else if (err.code === 'EACCES') {
        console.warn(`[FileInfoExtractor] 无权限访问: ${filePath}`)
      } else {
        console.warn(`[FileInfoExtractor] 无法访问文件: ${filePath} - ${err.message}`)
      }
      return null
    }

    console.log(`[FileInfoExtractor] 开始提取: ${filePath}`)

    try {
      // 并行提取各项信息
      const [basicInfo, versionInfo, signatureInfo, hashes] = await Promise.all([
        this.getBasicInfo(filePath),
        this.getVersionInfo(filePath),
        this.getSignatureInfo(filePath),
        this.calculateHashes(filePath),
      ])

      if (!basicInfo) return null

      const fileInfo: FileInfo = {
        filePath: basicInfo.filePath,
        fileSize: basicInfo.fileSize,
        createTime: basicInfo.createTime,
        modifyTime: basicInfo.modifyTime,
        version: versionInfo?.version || '',
        description: versionInfo?.description || '',
        company: versionInfo?.company || '',
        signature: signatureInfo,
        md5: hashes?.md5 || '',
        sha256: hashes?.sha256 || '',
      }

      // 缓存结果（使用 LRU 风格限制缓存大小）
      fileInfoCache.set(filePath, fileInfo)
      if (fileInfoCache.size > 500) {
        const firstKey = fileInfoCache.keys().next().value
        if (firstKey) fileInfoCache.delete(firstKey)
      }

      return fileInfo
    } catch (error) {
      console.error(`[FileInfoExtractor] 提取失败 [${filePath}]:`, error)
      return null
    }
  }

  /**
   * 获取文件基本信息（使用 fs.promises 异步 API）
   */
  private async getBasicInfo(filePath: string): Promise<{
    filePath: string
    fileSize: number
    createTime: Date
    modifyTime: Date
  } | null> {
    try {
      const stat = await fs.promises.stat(filePath)
      return {
        filePath,
        fileSize: stat.size,
        createTime: stat.birthtime,
        modifyTime: stat.mtime,
      }
    } catch (err: any) {
      console.warn(`[FileInfoExtractor] stat 失败 [${filePath}]: ${err.message}`)
      return null
    }
  }

  /**
   * 获取版本信息（PowerShell）
   */
  private async getVersionInfo(filePath: string): Promise<{
    version: string
    description: string
    company: string
  } | null> {
    const escapedPath = filePath.replace(/'/g, "''")
    try {
      const psScript = `
        $file = Get-Item '${escapedPath}' -ErrorAction SilentlyContinue;
        if (-not $file) { exit 1 }
        $vi = $file.VersionInfo;
        if (-not $vi) { exit 1 }
        [PSCustomObject]@{
          FileVersion = $vi.FileVersion
          ProductName = $vi.ProductName
          CompanyName = $vi.CompanyName
          FileDescription = $vi.FileDescription
        } | ConvertTo-Json -Compress
      `

      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "${psScript}"`,
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: 10000, windowsHide: true }
      )

      if (!stdout || stdout.trim().length === 0) return null

      const info = JSON.parse(stdout)
      return {
        version: info.FileVersion || '',
        description: info.FileDescription || '',
        company: info.CompanyName || '',
      }
    } catch (error) {
      // 静默失败 — 版本信息不是关键数据
      return null
    }
  }

  /**
   * 获取数字签名信息（PowerShell Get-AuthenticodeSignature）
   */
  private async getSignatureInfo(filePath: string): Promise<SignatureInfo> {
    const escapedPath = filePath.replace(/'/g, "''")
    try {
      const psScript = `
        $sig = Get-AuthenticodeSignature '${escapedPath}';
        if ($sig.Status -eq 'Valid') {
          [PSCustomObject]@{
            Status = 'valid'
            SignerName = $sig.SignerCertificate.Subject
            IssuerName = $sig.SignerCertificate.IssuerName
            SignedAt = if ($sig.TimeStamperCertificate) { $sig.TimeStamperCertificate.Subject } else { '' }
          } | ConvertTo-Json -Compress
        } elseif ($sig.Status -eq 'NotSigned') {
          '{"Status":"unsigned"}' | Write-Output
        } else {
          '{"Status":"invalid"}' | Write-Output
        }
      `

      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "${psScript}"`,
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: 15000, windowsHide: true }
      )

      if (!stdout || stdout.trim().length === 0) {
        return { status: 'unsigned' }
      }

      const sigInfo = JSON.parse(stdout)
      return {
        status: (sigInfo.Status || 'unsigned') as 'valid' | 'invalid' | 'unsigned',
        signerName: sigInfo.SignerName || undefined,
        issuerName: sigInfo.IssuerName || sigInfo.IssuerName || undefined,
      }
    } catch (error) {
      console.warn(`[FileInfoExtractor] 签名检查失败 [${path.basename(filePath)}]:`, (error as Error).message)
      return { status: 'unsigned' }
    }
  }

  /**
   * 计算文件哈希（异步 + 大文件优化 + 并发控制）
   *
   * 优化策略：
   * - 使用 fs.promises 异步读取
   * - 大文件(>50MB)只读取头尾各 1MB
   * - 通过 ConcurrencyLimiter 限制最多 6 个同时计算
   */
  private async calculateHashes(filePath: string): Promise<{
    md5: string
    sha256: string
  } | null> {
    return hashLimiter.run(async () => {
      try {
        const stat = await fs.promises.stat(filePath)
        const fileSize = stat.size

        let buffer: Buffer

        if (fileSize > LARGE_FILE_THRESHOLD) {
          // 大文件优化：只读取头 1MB + 尾 1MB
          console.log(`[FileInfoExtractor] 大文件哈希 (${(fileSize / 1024 / 1024).toFixed(1)}MB), 使用采样模式`)
          const headSize = Math.min(CHUNK_SIZE, fileSize)
          const tailSize = Math.min(CHUNK_SIZE, fileSize - headSize)

          const [headBuffer, tailBuffer] = await Promise.all([
            this.readFileChunk(filePath, 0, headSize),
            this.readFileChunk(filePath, fileSize - tailSize, tailSize),
          ])

          buffer = Buffer.concat([headBuffer, tailBuffer])
        } else {
          // 小文件：完整读取
          buffer = await fs.promises.readFile(filePath)
        }

        const md5 = crypto.createHash('md5').update(buffer).digest('hex')
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')

        return { md5, sha256 }
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          console.warn(`[FileInfoExtractor] 哈希计算-文件不存在: ${filePath}`)
        } else if (err.code === 'EACCES') {
          console.warn(`[FileInfoExtractor] 哈希计算-权限拒绝: ${filePath}`)
        } else if (err.code === 'EBUSY') {
          console.warn(`[FileInfoExtractor] 哈希计算-文件被占用: ${filePath}`)
        } else {
          console.warn(`[FileInfoExtractor] 哈希计算失败 [${filePath}]:`, err.message)
        }
        return null
      }
    })
  }

  /**
   * 异步读取文件指定范围
   */
  private async readFileChunk(filePath: string, offset: number, length: number): Promise<Buffer> {
    const fd = await fs.promises.open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(length)
      await fd.read(buffer, 0, length, offset)
      return buffer
    } finally {
      await fd.close()
    }
  }

  /** 清除缓存 */
  clearCache(): void {
    fileInfoCache.clear()
    console.log('[FileInfoExtractor] 缓存已清除')
  }

  /** 获取缓存信息 */
  getCachedInfo(filePath: string): FileInfo | undefined {
    return fileInfoCache.get(filePath)
  }

  /** 获取缓存统计 */
  getCacheStats(): { size: number } {
    return { size: fileInfoCache.size }
  }
}

export const fileInfoExtractor = new FileInfoExtractor()
