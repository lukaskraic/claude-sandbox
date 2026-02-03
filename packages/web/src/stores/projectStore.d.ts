import type { Project, CreateProjectInput } from '@claude-sandbox/shared';
export declare const useProjectStore: import("pinia").StoreDefinition<"project", Pick<{
    projects: import("vue").Ref<{
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    }[], Project[] | {
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    projectById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    fetchProjects: () => Promise<void>;
    createProject: (input: CreateProjectInput) => Promise<any>;
    deleteProject: (id: string) => Promise<void>;
}, "projects" | "loading" | "error">, Pick<{
    projects: import("vue").Ref<{
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    }[], Project[] | {
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    projectById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    fetchProjects: () => Promise<void>;
    createProject: (input: CreateProjectInput) => Promise<any>;
    deleteProject: (id: string) => Promise<void>;
}, "projectById">, Pick<{
    projects: import("vue").Ref<{
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    }[], Project[] | {
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    projectById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        description?: string | undefined;
        git: {
            remote: string;
            defaultBranch: string;
            worktreeBase?: string | undefined;
        };
        environment: {
            baseImage: string;
            runtimes?: {
                java?: string | undefined;
                node?: string | undefined;
                python?: string | undefined;
                go?: string | undefined;
            } | undefined;
            packages?: string[] | undefined;
            tools?: {
                npm?: string[] | undefined;
                pip?: string[] | undefined;
                custom?: string[] | undefined;
            } | undefined;
            services?: {
                type: import("@claude-sandbox/shared").ServiceType;
                version: string;
                database?: string | undefined;
                user?: string | undefined;
                password?: string | undefined;
                initSqlFile?: string | undefined;
            }[] | undefined;
            setup?: string | undefined;
            ports?: string[] | undefined;
            env?: Record<string, string> | undefined;
            proxy?: {
                http?: string | undefined;
                https?: string | undefined;
                noProxy?: string | undefined;
            } | undefined;
        };
        mounts?: {
            source: string;
            target: string;
            readonly?: boolean | undefined;
        }[] | undefined;
        claude?: {
            claudeMd?: string | undefined;
            permissions?: string[] | undefined;
        } | undefined;
        createdAt: Date;
        updatedAt: Date;
    } | undefined>;
    fetchProjects: () => Promise<void>;
    createProject: (input: CreateProjectInput) => Promise<any>;
    deleteProject: (id: string) => Promise<void>;
}, "fetchProjects" | "createProject" | "deleteProject">>;
//# sourceMappingURL=projectStore.d.ts.map