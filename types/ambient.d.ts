declare function _(id: string): string;
declare function print(args: string): void;
declare function log(obj: object, others?: object[]): void;
declare function log(msg: string, subsitutions?: any[]): void;

declare const pkg: {
  version: string;
  name: string;
};

declare module console {
  export function error(...args: any[]): void;
  export function log(...args: any[]): void;
  export function warn(...args: any[]): void;
  export function debug(...args: any[]): void;
}

declare interface String {
  format(...replacements: string[]): string;
  format(...replacements: number[]): string;
}
declare interface Number {
  toFixed(digits: number): number;
}

declare class TextEncoder {
  constructor(encoding?: string);
  encode(input?: string): Uint8Array;
}

declare class TextDecoder {
  constructor(encoding?: string);
  decode(input?: Uint8Array): string;
}
