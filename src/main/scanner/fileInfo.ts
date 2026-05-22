import fs from 'fs'
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
    if (this.active >= this.limit) await new Promise<void>(r => this.queue.push(r))
    this.active++
    try { return await fn() }
    finally {
      this.active--
      if (this.queue.length > 0) this.queue.shift()!()
    }
  }
}

const hashLimiter = new ConcurrencyLimiter(6)  // 最多 6 个并发哈希
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024  // 50MB
const CHUNK_SIZE = 1 * 1024 * 1024             // 1MB

/**
 * FileInfoExtractor - 文件元数据提取
 *
 * 性能优化：
 * - 异步哈希计算（fs.promises）
 * - 6 并发限制
 * - 大文件(>50MB)仅读取头尾各 1MB
 * - 友好错误处理（不存在/无权限/被占用）
 */
export class FileInfoExtractor {
  async getFileInfo(filePath: string, useCache: boolean = true): Promise<FileInfo | null> {
    if (useCache) {
      const cached = fileInfoCache.get(filePath)
      if (cached) return cached
    }

    // 文件存在 + 权限检查
    try { await fs.promises.access(filePath, fs.constants.R_OK) }
    catch (err: any) {
      if (err.code === 'ENOENT') return null
      if (err.code === 'EACCES') return null
      return null
    }

    try {
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

      fileInfoCache.set(filePath, fileInfo)
      if (fileInfoCache.size > 500) {
        const firstKey = fileInfoCache.keys().next().value
        if (firstKey) fileInfoCache.delete(firstKey)
      }

      return fileInfo
    } catch {
      return null
    }
  }

  private async getBasicInfo(filePath: string): Promise<{ filePath: string; fileSize: number; createTime: Date; modifyTime: Date } | null> {
    try {
      const stat = await fs.promises.stat(filePath)
      return { filePath, fileSize: stat.size, createTime: stat.birthtime, modifyTime: stat.mtime }
    } catch { return null }
  }

  private async getVersionInfo(filePath: string): Promise<{ version: string; description: string; company: string } | null> {
    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "$vi=(Get-Item '${filePath.replace(/'/g, "''")}' -ErrorAction SilentlyContinue).VersionInfo; if($vi){@{FileVersion=$vi.FileVersion;FileDescription=$vi.FileDescription;CompanyName=$vi.CompanyName}|ConvertTo-Json -Compress}"`,
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: 10000, windowsHide: true }
      )
      if (!stdout || stdout.trim().length === 0) return null
      const info = JSON.parse(stdout)
      return { version: info.FileVersion || '', description: info.FileDescription || '', company: info.CompanyName || '' }
    } catch { return null }
  }

  private async getSignatureInfo(filePath: string): Promise<SignatureInfo> {
    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "$sig=Get-AuthenticodeSignature '${filePath.replace(/'/g, "''")}'; if($sig.Status -eq 'Valid'){@{Status='valid';SignerName=$sig.SignerCertificate.Subject}|ConvertTo-Json -Compress}elseif($sig.Status -eq 'NotSigned'){'{\"Status\":\"unsigned\"}'|Write-Output}else{'{\"Status\":\"invalid\"}'|Write-Output}"`,
        { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: 15000, windowsHide: true }
      )
      if (!stdout || stdout.trim().length === 0) return { status: 'unsigned' }
      const sig = JSON.parse(stdout)
      return { status: (sig.Status || 'unsigned') as 'valid' | 'invalid' | 'unsigned', signerName: sig.SignerName || undefined }
    } catch { return { status: 'unsigned' } }
  }

  /**
   * 异步哈希计算 + 并发限制 + 大文件优化
   */
  private async calculateHashes(filePath: string): Promise<{ md5: string; sha256: string } | null> {
    return hashLimiter.run(async () => {
      try {
        const stat = await fs.promises.stat(filePath)
        let buffer: Buffer

        if (stat.size > LARGE_FILE_THRESHOLD) {
          const headSize = Math.min(CHUNK_SIZE, stat.size)
          const tailSize = Math.min(CHUNK_SIZE, stat.size - headSize)
          const [head, tail] = await Promise.all([
            this.readChunk(filePath, 0, headSize),
            this.readChunk(filePath, stat.size - tailSize, tailSize),
          ])
          buffer = Buffer.concat([head, tail])
        } else {
          buffer = await fs.promises.readFile(filePath)
        }

        return {
          md5: crypto.createHash('md5').update(buffer).digest('hex'),
          sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        }
      } catch { return null }
    })
  }

  private async readChunk(filePath: string, offset: number, length: number): Promise<Buffer> {
    const fd = await fs.promises.open(filePath, 'r')
    try {
      const buf = Buffer.alloc(length)
      await fd.read(buf, 0, length, offset)
      return buf
    } finally { await fd.close() }
  }

  clearCache(): void { fileInfoCache.clear() }
  getCachedInfo(filePath: string): FileInfo | undefined { return fileInfoCache.get(filePath) }
  getCacheStats(): { size: number } { return { size: fileInfoCache.size } }
}

export const fileInfoExtractor = new FileInfoExtractor()
