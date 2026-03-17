import type { ProtocolAdapter, ProtocolName } from '../types'

class ProtocolRegistry {
  private adapters = new Map<ProtocolName, ProtocolAdapter>()

  register(adapter: ProtocolAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter already registered for protocol: ${adapter.name}`)
    }
    this.adapters.set(adapter.name, adapter)
  }

  get(name: ProtocolName): ProtocolAdapter | undefined {
    return this.adapters.get(name)
  }

  detect(request: Request): ProtocolAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(request)) {
        return adapter
      }
    }
    return undefined
  }

  list(): ProtocolAdapter[] {
    return Array.from(this.adapters.values())
  }

  has(name: ProtocolName): boolean {
    return this.adapters.has(name)
  }

  clear(): void {
    this.adapters.clear()
  }
}

export const protocolRegistry = new ProtocolRegistry()
export { ProtocolRegistry }
