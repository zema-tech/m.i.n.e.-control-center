/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols
// Generated-style route tree for TanStack Router

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as LoginRouteImport } from './routes/login'
import { Route as HomeRouteImport } from './routes/home'
import { Route as JarvisRouteImport } from './routes/jarvis'
import { Route as MineRouteImport } from './routes/mine'
import { Route as DesignRouteImport } from './routes/design'
import { Route as AgentRouteImport } from './routes/agent'
import { Route as CodeRouteImport } from './routes/code'
import { Route as NetworkRouteImport } from './routes/network'
import { Route as SkillsRouteImport } from './routes/skills'
import { Route as HostsRouteImport } from './routes/hosts'
import { Route as ConnectorsRouteImport } from './routes/connectors'
import { Route as AssistantIndexRouteImport } from './routes/assistant.index'
import { Route as AssistantThreadIdRouteImport } from './routes/assistant.$threadId'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)
const LoginRoute = LoginRouteImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRouteImport,
} as any)
const HomeRoute = HomeRouteImport.update({
  id: '/home',
  path: '/home',
  getParentRoute: () => rootRouteImport,
} as any)
const JarvisRoute = JarvisRouteImport.update({
  id: '/jarvis',
  path: '/jarvis',
  getParentRoute: () => rootRouteImport,
} as any)
const MineRoute = MineRouteImport.update({
  id: '/mine',
  path: '/mine',
  getParentRoute: () => rootRouteImport,
} as any)
const DesignRoute = DesignRouteImport.update({
  id: '/design',
  path: '/design',
  getParentRoute: () => rootRouteImport,
} as any)
const AgentRoute = AgentRouteImport.update({
  id: '/agent',
  path: '/agent',
  getParentRoute: () => rootRouteImport,
} as any)
const CodeRoute = CodeRouteImport.update({
  id: '/code',
  path: '/code',
  getParentRoute: () => rootRouteImport,
} as any)
const NetworkRoute = NetworkRouteImport.update({
  id: '/network',
  path: '/network',
  getParentRoute: () => rootRouteImport,
} as any)
const SkillsRoute = SkillsRouteImport.update({
  id: '/skills',
  path: '/skills',
  getParentRoute: () => rootRouteImport,
} as any)
const HostsRoute = HostsRouteImport.update({
  id: '/hosts',
  path: '/hosts',
  getParentRoute: () => rootRouteImport,
} as any)
const ConnectorsRoute = ConnectorsRouteImport.update({
  id: '/connectors',
  path: '/connectors',
  getParentRoute: () => rootRouteImport,
} as any)
const AssistantIndexRoute = AssistantIndexRouteImport.update({
  id: '/assistant/',
  path: '/assistant/',
  getParentRoute: () => rootRouteImport,
} as any)
const AssistantThreadIdRoute = AssistantThreadIdRouteImport.update({
  id: '/assistant/$threadId',
  path: '/assistant/$threadId',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/home': typeof HomeRoute
  '/jarvis': typeof JarvisRoute
  '/mine': typeof MineRoute
  '/design': typeof DesignRoute
  '/agent': typeof AgentRoute
  '/code': typeof CodeRoute
  '/network': typeof NetworkRoute
  '/skills': typeof SkillsRoute
  '/hosts': typeof HostsRoute
  '/connectors': typeof ConnectorsRoute
  '/assistant/$threadId': typeof AssistantThreadIdRoute
  '/assistant/': typeof AssistantIndexRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/home': typeof HomeRoute
  '/jarvis': typeof JarvisRoute
  '/mine': typeof MineRoute
  '/design': typeof DesignRoute
  '/agent': typeof AgentRoute
  '/code': typeof CodeRoute
  '/network': typeof NetworkRoute
  '/skills': typeof SkillsRoute
  '/hosts': typeof HostsRoute
  '/connectors': typeof ConnectorsRoute
  '/assistant/$threadId': typeof AssistantThreadIdRoute
  '/assistant': typeof AssistantIndexRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/home': typeof HomeRoute
  '/jarvis': typeof JarvisRoute
  '/mine': typeof MineRoute
  '/design': typeof DesignRoute
  '/agent': typeof AgentRoute
  '/code': typeof CodeRoute
  '/network': typeof NetworkRoute
  '/skills': typeof SkillsRoute
  '/hosts': typeof HostsRoute
  '/connectors': typeof ConnectorsRoute
  '/assistant/$threadId': typeof AssistantThreadIdRoute
  '/assistant/': typeof AssistantIndexRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/login'
    | '/home'
    | '/jarvis'
    | '/mine'
    | '/design'
    | '/agent'
    | '/code'
    | '/network'
    | '/skills'
    | '/hosts'
    | '/connectors'
    | '/assistant/$threadId'
    | '/assistant/'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/login'
    | '/home'
    | '/jarvis'
    | '/mine'
    | '/design'
    | '/agent'
    | '/code'
    | '/network'
    | '/skills'
    | '/hosts'
    | '/connectors'
    | '/assistant/$threadId'
    | '/assistant'
  id:
    | '__root__'
    | '/'
    | '/login'
    | '/home'
    | '/jarvis'
    | '/mine'
    | '/design'
    | '/agent'
    | '/code'
    | '/network'
    | '/skills'
    | '/hosts'
    | '/connectors'
    | '/assistant/$threadId'
    | '/assistant/'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  LoginRoute: typeof LoginRoute
  HomeRoute: typeof HomeRoute
  JarvisRoute: typeof JarvisRoute
  MineRoute: typeof MineRoute
  DesignRoute: typeof DesignRoute
  AgentRoute: typeof AgentRoute
  CodeRoute: typeof CodeRoute
  NetworkRoute: typeof NetworkRoute
  SkillsRoute: typeof SkillsRoute
  HostsRoute: typeof HostsRoute
  ConnectorsRoute: typeof ConnectorsRoute
  AssistantThreadIdRoute: typeof AssistantThreadIdRoute
  AssistantIndexRoute: typeof AssistantIndexRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/home': {
      id: '/home'
      path: '/home'
      fullPath: '/home'
      preLoaderRoute: typeof HomeRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/jarvis': {
      id: '/jarvis'
      path: '/jarvis'
      fullPath: '/jarvis'
      preLoaderRoute: typeof JarvisRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/mine': {
      id: '/mine'
      path: '/mine'
      fullPath: '/mine'
      preLoaderRoute: typeof MineRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/design': {
      id: '/design'
      path: '/design'
      fullPath: '/design'
      preLoaderRoute: typeof DesignRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/agent': {
      id: '/agent'
      path: '/agent'
      fullPath: '/agent'
      preLoaderRoute: typeof AgentRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/code': {
      id: '/code'
      path: '/code'
      fullPath: '/code'
      preLoaderRoute: typeof CodeRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/network': {
      id: '/network'
      path: '/network'
      fullPath: '/network'
      preLoaderRoute: typeof NetworkRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/skills': {
      id: '/skills'
      path: '/skills'
      fullPath: '/skills'
      preLoaderRoute: typeof SkillsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/hosts': {
      id: '/hosts'
      path: '/hosts'
      fullPath: '/hosts'
      preLoaderRoute: typeof HostsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/connectors': {
      id: '/connectors'
      path: '/connectors'
      fullPath: '/connectors'
      preLoaderRoute: typeof ConnectorsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/assistant/': {
      id: '/assistant/'
      path: '/assistant'
      fullPath: '/assistant/'
      preLoaderRoute: typeof AssistantIndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/assistant/$threadId': {
      id: '/assistant/$threadId'
      path: '/assistant/$threadId'
      fullPath: '/assistant/$threadId'
      preLoaderRoute: typeof AssistantThreadIdRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  LoginRoute: LoginRoute,
  HomeRoute: HomeRoute,
  JarvisRoute: JarvisRoute,
  MineRoute: MineRoute,
  DesignRoute: DesignRoute,
  AgentRoute: AgentRoute,
  CodeRoute: CodeRoute,
  NetworkRoute: NetworkRoute,
  SkillsRoute: SkillsRoute,
  HostsRoute: HostsRoute,
  ConnectorsRoute: ConnectorsRoute,
  AssistantThreadIdRoute: AssistantThreadIdRoute,
  AssistantIndexRoute: AssistantIndexRoute,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
