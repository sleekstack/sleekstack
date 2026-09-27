/**
 * apps/playground/src/tags.ts
 *
 * Tag-only module (R11): identifiers safe for client code to import. No
 * implementations here — see ./services.server.ts for the Layer factories.
 * A bundle that imports only this file never pulls in a server implementation
 * (proven by src/__tests__/bundle.test.ts).
 */
import { Context } from 'effect'

export interface LoggerService {
  log(message: string): void
  prefix: string
}

export interface HttpClientService {
  get(url: string): Promise<string>
}

export interface UserApiService {
  getGreeting(name: string): Promise<string>
}

export const Logger = Context.GenericTag<LoggerService>('Logger')
export const HttpClient = Context.GenericTag<HttpClientService>('HttpClient')
export const UserApi = Context.GenericTag<UserApiService>('UserApi')
