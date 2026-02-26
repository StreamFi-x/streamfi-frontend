export interface DependencyStatus {
  key: string;
  healthy: boolean;
  latencyMs: number;
  checkedAt: string;
}

export interface DependencyHealthPayload {
  healthy: boolean;
  deps: DependencyStatus[];
}

const MOCK_DEPENDENCIES = [
  { key: "auth-service", healthy: true, latencyMs: 32 },
  { key: "stream-indexer", healthy: true, latencyMs: 54 },
  { key: "tip-ledger", healthy: true, latencyMs: 41 },
] as const;

export async function checkDependencies(params?: {
  now?: Date;
  failDependencyKey?: string;
}): Promise<DependencyHealthPayload> {
  const checkedAt = (params?.now ?? new Date()).toISOString();

  const deps: DependencyStatus[] = MOCK_DEPENDENCIES.map(dep => ({
    key: dep.key,
    healthy:
      params?.failDependencyKey && params.failDependencyKey === dep.key
        ? false
        : dep.healthy,
    latencyMs: dep.latencyMs,
    checkedAt,
  }));

  if (deps.some(dep => !dep.healthy)) {
    throw new Error("Dependency check failed");
  }

  return {
    healthy: true,
    deps,
  };
}

export function getDependencyKeys(): string[] {
  return MOCK_DEPENDENCIES.map(dep => dep.key);
}
