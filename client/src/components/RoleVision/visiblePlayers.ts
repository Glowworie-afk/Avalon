import type { RoleInfo } from '@avalon/shared'

export function visiblePlayers(info: RoleInfo | null) {
  if (info?.knownEvil?.length) return info.knownEvil.map(openid => ({ openid, label: '梅林视野' }))
  if (info?.merlinCandidates?.length) return info.merlinCandidates.map(openid => ({ openid, label: '梅林候选' }))
  if (info?.fellowEvil?.length) return info.fellowEvil.map(openid => ({ openid, label: '邪恶同伙' }))
  return []
}
