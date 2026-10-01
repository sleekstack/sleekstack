import { Context } from 'effect'

export class App extends Context.Tag('App')<App, object>() {}
export class Req extends Context.Tag('Req')<Req, object>() {}
export class A extends Context.Tag('A')<A, object>() {}
export class Z extends Context.Tag('Z')<Z, object>() {}
