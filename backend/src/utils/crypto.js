import crypto from 'node:crypto'

const ALGO = 'aes-256-gcm'

function getKey() {
  const hex = process.env.SENSITIVE_DATA_KEY
  if (!hex || hex.length !== 64) throw new Error('SENSITIVE_DATA_KEY inválida o no configurada')
  return Buffer.from(hex, 'hex')
}

export function encrypt(text) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`
}

export function decrypt(stored) {
  const [ivHex, tagHex, dataHex] = stored.split(':')
  const dec = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(dataHex, 'hex')) + dec.final('utf8')
}

export function isEncrypted(text) {
  return typeof text === 'string' && /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(text)
}
