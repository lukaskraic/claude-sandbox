import type { ProjectContainer, ContainerImage, ProjectNetwork, ProjectVolume, ContainerStats, ProjectResourceSummary, BatchOperationResult } from '@claude-sandbox/shared';
export declare const useContainerStore: import("pinia").StoreDefinition<"container", Pick<{
    containers: import("vue").Ref<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[], ProjectContainer[] | {
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    images: import("vue").Ref<{
        id: string;
        tags: string[];
        size: number;
        created: Date;
        projectId?: string | undefined;
        configHash?: string | undefined;
        usedByContainers: number;
    }[], ContainerImage[] | {
        id: string;
        tags: string[];
        size: number;
        created: Date;
        projectId?: string | undefined;
        configHash?: string | undefined;
        usedByContainers: number;
    }[]>;
    networks: import("vue").Ref<{
        id: string;
        name: string;
        driver: string;
        scope: string;
        created: Date;
        containers: string[];
    }[], ProjectNetwork[] | {
        id: string;
        name: string;
        driver: string;
        scope: string;
        created: Date;
        containers: string[];
    }[]>;
    volumes: import("vue").Ref<{
        id: string;
        name: string;
        driver: string;
        mountpoint: string;
        created: Date;
        size?: number | undefined;
        usedByContainers: string[];
    }[], ProjectVolume[] | {
        id: string;
        name: string;
        driver: string;
        mountpoint: string;
        created: Date;
        size?: number | undefined;
        usedByContainers: string[];
    }[]>;
    stats: import("vue").Ref<Map<string, {
        containerId: string;
        cpuPercent: number;
        memoryUsage: number;
        memoryLimit: number;
        memoryPercent: number;
        networkRx: number;
        networkTx: number;
        blockRead: number;
        blockWrite: number;
        pids: number;
    }> & Omit<Map<string, ContainerStats>, keyof Map<any, any>>, Map<string, ContainerStats> | (Map<string, {
        containerId: string;
        cpuPercent: number;
        memoryUsage: number;
        memoryLimit: number;
        memoryPercent: number;
        networkRx: number;
        networkTx: number;
        blockRead: number;
        blockWrite: number;
        pids: number;
    }> & Omit<Map<string, ContainerStats>, keyof Map<any, any>>)>;
    summary: import("vue").Ref<{
        containers: {
            total: number;
            running: number;
            stopped: number;
            orphaned: number;
        };
        images: {
            total: number;
            size: number;
            unused: number;
        };
        networks: {
            total: number;
        };
        volumes: {
            total: number;
            size: number;
        };
    } | null, ProjectResourceSummary | {
        containers: {
            total: number;
            running: number;
            stopped: number;
            orphaned: number;
        };
        images: {
            total: number;
            size: number;
            unused: number;
        };
        networks: {
            total: number;
        };
        volumes: {
            total: number;
            size: number;
        };
    } | null>;
    orphanedContainers: import("vue").Ref<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[], ProjectContainer[] | {
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    runningContainers: import("vue").ComputedRef<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    stoppedContainers: import("vue").ComputedRef<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    fetchContainers: (projectId: string) => Promise<void>;
    fetchImages: (projectName: string) => Promise<void>;
    fetchNetworks: (projectId: string) => Promise<void>;
    fetchVolumes: (projectId: string) => Promise<void>;
    fetchSummary: (projectId: string, projectName: string) => Promise<void>;
    fetchOrphans: (projectId: string) => Promise<void>;
    fetchAll: (projectId: string, projectName: string) => Promise<void>;
    fetchContainerStats: (containerId: string) => Promise<any>;
    startContainer: (containerId: string) => Promise<void>;
    stopContainer: (containerId: string) => Promise<void>;
    removeContainer: (containerId: string) => Promise<void>;
    batchStopContainers: (containerIds: string[]) => Promise<BatchOperationResult>;
    batchRemoveContainers: (containerIds: string[]) => Promise<BatchOperationResult>;
    removeImage: (imageId: string) => Promise<void>;
    cleanupOrphans: (projectId: string) => Promise<BatchOperationResult>;
    clearError: () => void;
}, "loading" | "error" | "summary" | "containers" | "images" | "networks" | "volumes" | "stats" | "orphanedContainers">, Pick<{
    containers: import("vue").Ref<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[], ProjectContainer[] | {
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    images: import("vue").Ref<{
        id: string;
        tags: string[];
        size: number;
        created: Date;
        projectId?: string | undefined;
        configHash?: string | undefined;
        usedByContainers: number;
    }[], ContainerImage[] | {
        id: string;
        tags: string[];
        size: number;
        created: Date;
        projectId?: string | undefined;
        configHash?: string | undefined;
        usedByContainers: number;
    }[]>;
    networks: import("vue").Ref<{
        id: string;
        name: string;
        driver: string;
        scope: string;
        created: Date;
        containers: string[];
    }[], ProjectNetwork[] | {
        id: string;
        name: string;
        driver: string;
        scope: string;
        created: Date;
        containers: string[];
    }[]>;
    volumes: import("vue").Ref<{
        id: string;
        name: string;
        driver: string;
        mountpoint: string;
        created: Date;
        size?: number | undefined;
        usedByContainers: string[];
    }[], ProjectVolume[] | {
        id: string;
        name: string;
        driver: string;
        mountpoint: string;
        created: Date;
        size?: number | undefined;
        usedByContainers: string[];
    }[]>;
    stats: import("vue").Ref<Map<string, {
        containerId: string;
        cpuPercent: number;
        memoryUsage: number;
        memoryLimit: number;
        memoryPercent: number;
        networkRx: number;
        networkTx: number;
        blockRead: number;
        blockWrite: number;
        pids: number;
    }> & Omit<Map<string, ContainerStats>, keyof Map<any, any>>, Map<string, ContainerStats> | (Map<string, {
        containerId: string;
        cpuPercent: number;
        memoryUsage: number;
        memoryLimit: number;
        memoryPercent: number;
        networkRx: number;
        networkTx: number;
        blockRead: number;
        blockWrite: number;
        pids: number;
    }> & Omit<Map<string, ContainerStats>, keyof Map<any, any>>)>;
    summary: import("vue").Ref<{
        containers: {
            total: number;
            running: number;
            stopped: number;
            orphaned: number;
        };
        images: {
            total: number;
            size: number;
            unused: number;
        };
        networks: {
            total: number;
        };
        volumes: {
            total: number;
            size: number;
        };
    } | null, ProjectResourceSummary | {
        containers: {
            total: number;
            running: number;
            stopped: number;
            orphaned: number;
        };
        images: {
            total: number;
            size: number;
            unused: number;
        };
        networks: {
            total: number;
        };
        volumes: {
            total: number;
            size: number;
        };
    } | null>;
    orphanedContainers: import("vue").Ref<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[], ProjectContainer[] | {
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    runningContainers: import("vue").ComputedRef<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    stoppedContainers: import("vue").ComputedRef<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    fetchContainers: (projectId: string) => Promise<void>;
    fetchImages: (projectName: string) => Promise<void>;
    fetchNetworks: (projectId: string) => Promise<void>;
    fetchVolumes: (projectId: string) => Promise<void>;
    fetchSummary: (projectId: string, projectName: string) => Promise<void>;
    fetchOrphans: (projectId: string) => Promise<void>;
    fetchAll: (projectId: string, projectName: string) => Promise<void>;
    fetchContainerStats: (containerId: string) => Promise<any>;
    startContainer: (containerId: string) => Promise<void>;
    stopContainer: (containerId: string) => Promise<void>;
    removeContainer: (containerId: string) => Promise<void>;
    batchStopContainers: (containerIds: string[]) => Promise<BatchOperationResult>;
    batchRemoveContainers: (containerIds: string[]) => Promise<BatchOperationResult>;
    removeImage: (imageId: string) => Promise<void>;
    cleanupOrphans: (projectId: string) => Promise<BatchOperationResult>;
    clearError: () => void;
}, "runningContainers" | "stoppedContainers">, Pick<{
    containers: import("vue").Ref<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[], ProjectContainer[] | {
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    images: import("vue").Ref<{
        id: string;
        tags: string[];
        size: number;
        created: Date;
        projectId?: string | undefined;
        configHash?: string | undefined;
        usedByContainers: number;
    }[], ContainerImage[] | {
        id: string;
        tags: string[];
        size: number;
        created: Date;
        projectId?: string | undefined;
        configHash?: string | undefined;
        usedByContainers: number;
    }[]>;
    networks: import("vue").Ref<{
        id: string;
        name: string;
        driver: string;
        scope: string;
        created: Date;
        containers: string[];
    }[], ProjectNetwork[] | {
        id: string;
        name: string;
        driver: string;
        scope: string;
        created: Date;
        containers: string[];
    }[]>;
    volumes: import("vue").Ref<{
        id: string;
        name: string;
        driver: string;
        mountpoint: string;
        created: Date;
        size?: number | undefined;
        usedByContainers: string[];
    }[], ProjectVolume[] | {
        id: string;
        name: string;
        driver: string;
        mountpoint: string;
        created: Date;
        size?: number | undefined;
        usedByContainers: string[];
    }[]>;
    stats: import("vue").Ref<Map<string, {
        containerId: string;
        cpuPercent: number;
        memoryUsage: number;
        memoryLimit: number;
        memoryPercent: number;
        networkRx: number;
        networkTx: number;
        blockRead: number;
        blockWrite: number;
        pids: number;
    }> & Omit<Map<string, ContainerStats>, keyof Map<any, any>>, Map<string, ContainerStats> | (Map<string, {
        containerId: string;
        cpuPercent: number;
        memoryUsage: number;
        memoryLimit: number;
        memoryPercent: number;
        networkRx: number;
        networkTx: number;
        blockRead: number;
        blockWrite: number;
        pids: number;
    }> & Omit<Map<string, ContainerStats>, keyof Map<any, any>>)>;
    summary: import("vue").Ref<{
        containers: {
            total: number;
            running: number;
            stopped: number;
            orphaned: number;
        };
        images: {
            total: number;
            size: number;
            unused: number;
        };
        networks: {
            total: number;
        };
        volumes: {
            total: number;
            size: number;
        };
    } | null, ProjectResourceSummary | {
        containers: {
            total: number;
            running: number;
            stopped: number;
            orphaned: number;
        };
        images: {
            total: number;
            size: number;
            unused: number;
        };
        networks: {
            total: number;
        };
        volumes: {
            total: number;
            size: number;
        };
    } | null>;
    orphanedContainers: import("vue").Ref<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[], ProjectContainer[] | {
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    runningContainers: import("vue").ComputedRef<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    stoppedContainers: import("vue").ComputedRef<{
        id: string;
        name: string;
        sessionId?: string | undefined;
        sessionName?: string | undefined;
        image: string;
        state: import("@claude-sandbox/shared").ContainerState;
        status: string;
        created: Date;
        ports: Record<number, number>;
        type: "main" | "service";
    }[]>;
    fetchContainers: (projectId: string) => Promise<void>;
    fetchImages: (projectName: string) => Promise<void>;
    fetchNetworks: (projectId: string) => Promise<void>;
    fetchVolumes: (projectId: string) => Promise<void>;
    fetchSummary: (projectId: string, projectName: string) => Promise<void>;
    fetchOrphans: (projectId: string) => Promise<void>;
    fetchAll: (projectId: string, projectName: string) => Promise<void>;
    fetchContainerStats: (containerId: string) => Promise<any>;
    startContainer: (containerId: string) => Promise<void>;
    stopContainer: (containerId: string) => Promise<void>;
    removeContainer: (containerId: string) => Promise<void>;
    batchStopContainers: (containerIds: string[]) => Promise<BatchOperationResult>;
    batchRemoveContainers: (containerIds: string[]) => Promise<BatchOperationResult>;
    removeImage: (imageId: string) => Promise<void>;
    cleanupOrphans: (projectId: string) => Promise<BatchOperationResult>;
    clearError: () => void;
}, "fetchContainers" | "fetchImages" | "fetchNetworks" | "fetchVolumes" | "fetchSummary" | "fetchOrphans" | "fetchAll" | "fetchContainerStats" | "startContainer" | "stopContainer" | "removeContainer" | "batchStopContainers" | "batchRemoveContainers" | "removeImage" | "cleanupOrphans" | "clearError">>;
//# sourceMappingURL=containerStore.d.ts.map