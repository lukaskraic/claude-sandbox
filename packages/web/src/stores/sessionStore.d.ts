import type { Session, CreateSessionInput } from '@claude-sandbox/shared';
export declare const useSessionStore: import("pinia").StoreDefinition<"session", Pick<{
    sessions: import("vue").Ref<{
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[], Session[] | {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    sessionById: import("vue").ComputedRef<(id: string) => {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    } | undefined>;
    sessionsByProject: import("vue").ComputedRef<(projectId: string) => {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[]>;
    fetchSessions: () => Promise<void>;
    createSession: (projectId: string, input: CreateSessionInput) => Promise<any>;
    startSession: (id: string) => Promise<any>;
    stopSession: (id: string) => Promise<any>;
    removeSession: (id: string) => Promise<void>;
    updateSession: (session: Session) => void;
}, "loading" | "error" | "sessions">, Pick<{
    sessions: import("vue").Ref<{
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[], Session[] | {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    sessionById: import("vue").ComputedRef<(id: string) => {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    } | undefined>;
    sessionsByProject: import("vue").ComputedRef<(projectId: string) => {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[]>;
    fetchSessions: () => Promise<void>;
    createSession: (projectId: string, input: CreateSessionInput) => Promise<any>;
    startSession: (id: string) => Promise<any>;
    stopSession: (id: string) => Promise<any>;
    removeSession: (id: string) => Promise<void>;
    updateSession: (session: Session) => void;
}, "sessionById" | "sessionsByProject">, Pick<{
    sessions: import("vue").Ref<{
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[], Session[] | {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    sessionById: import("vue").ComputedRef<(id: string) => {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    } | undefined>;
    sessionsByProject: import("vue").ComputedRef<(projectId: string) => {
        id: string;
        projectId: string;
        name: string;
        status: import("@claude-sandbox/shared").SessionStatus;
        worktree?: {
            path: string;
            branch: string;
            baseBranch?: string | undefined;
            commit?: string | undefined;
        } | undefined;
        container?: {
            id: string;
            ports: Record<number, number>;
            serviceContainers?: string[] | undefined;
            networkId?: string | undefined;
        } | undefined;
        claudeSourceUser?: string | undefined;
        gitUserName?: string | undefined;
        gitUserEmail?: string | undefined;
        githubToken?: string | undefined;
        error?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        createdBy?: string | undefined;
    }[]>;
    fetchSessions: () => Promise<void>;
    createSession: (projectId: string, input: CreateSessionInput) => Promise<any>;
    startSession: (id: string) => Promise<any>;
    stopSession: (id: string) => Promise<any>;
    removeSession: (id: string) => Promise<void>;
    updateSession: (session: Session) => void;
}, "fetchSessions" | "createSession" | "startSession" | "stopSession" | "removeSession" | "updateSession">>;
//# sourceMappingURL=sessionStore.d.ts.map