/// <reference types="node" />
import { ChildProcess } from "child_process";
export interface ISpawnOptions {
    cwd?: string;
    env?: any;
    stdio?: any;
    detached?: boolean;
    uid?: number;
    gid?: number;
    stream?: string;
    shell?: boolean | string;
}
export interface ISpawnFunction {
    callback: (data?: string) => boolean | void;
    type: string;
    description: string;
    expected?: string | RegExp;
}
export declare class SpawnChain {
    private command;
    private args;
    private options;
    private queue;
    private process;
    constructor(command: string, args: string[], options: ISpawnOptions);
    expect(expectation: string | RegExp): SpawnChain;
    wait(expectation: string | RegExp, callback?: (_: string) => void): SpawnChain;
    sendline(line: string): SpawnChain;
    sendEof(): SpawnChain;
    run(callback: (err?: Error, output?: string[], exit?: string | number) => void): ChildProcess;
}
export declare function spawn(command: string, args?: string[], options?: ISpawnOptions): SpawnChain;
