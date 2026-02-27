
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Project
 * 
 */
export type Project = $Result.DefaultSelection<Prisma.$ProjectPayload>
/**
 * Model ClientDelay
 * 
 */
export type ClientDelay = $Result.DefaultSelection<Prisma.$ClientDelayPayload>
/**
 * Model Operator
 * 
 */
export type Operator = $Result.DefaultSelection<Prisma.$OperatorPayload>
/**
 * Model FavoriteBlock
 * 
 */
export type FavoriteBlock = $Result.DefaultSelection<Prisma.$FavoriteBlockPayload>
/**
 * Model Planning
 * 
 */
export type Planning = $Result.DefaultSelection<Prisma.$PlanningPayload>
/**
 * Model HdbClient
 * 
 */
export type HdbClient = $Result.DefaultSelection<Prisma.$HdbClientPayload>
/**
 * Model TimeEntry
 * 
 */
export type TimeEntry = $Result.DefaultSelection<Prisma.$TimeEntryPayload>

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Projects
 * const projects = await prisma.project.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Projects
   * const projects = await prisma.project.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.project`: Exposes CRUD operations for the **Project** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Projects
    * const projects = await prisma.project.findMany()
    * ```
    */
  get project(): Prisma.ProjectDelegate<ExtArgs>;

  /**
   * `prisma.clientDelay`: Exposes CRUD operations for the **ClientDelay** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ClientDelays
    * const clientDelays = await prisma.clientDelay.findMany()
    * ```
    */
  get clientDelay(): Prisma.ClientDelayDelegate<ExtArgs>;

  /**
   * `prisma.operator`: Exposes CRUD operations for the **Operator** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Operators
    * const operators = await prisma.operator.findMany()
    * ```
    */
  get operator(): Prisma.OperatorDelegate<ExtArgs>;

  /**
   * `prisma.favoriteBlock`: Exposes CRUD operations for the **FavoriteBlock** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more FavoriteBlocks
    * const favoriteBlocks = await prisma.favoriteBlock.findMany()
    * ```
    */
  get favoriteBlock(): Prisma.FavoriteBlockDelegate<ExtArgs>;

  /**
   * `prisma.planning`: Exposes CRUD operations for the **Planning** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Plannings
    * const plannings = await prisma.planning.findMany()
    * ```
    */
  get planning(): Prisma.PlanningDelegate<ExtArgs>;

  /**
   * `prisma.hdbClient`: Exposes CRUD operations for the **HdbClient** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more HdbClients
    * const hdbClients = await prisma.hdbClient.findMany()
    * ```
    */
  get hdbClient(): Prisma.HdbClientDelegate<ExtArgs>;

  /**
   * `prisma.timeEntry`: Exposes CRUD operations for the **TimeEntry** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TimeEntries
    * const timeEntries = await prisma.timeEntry.findMany()
    * ```
    */
  get timeEntry(): Prisma.TimeEntryDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Project: 'Project',
    ClientDelay: 'ClientDelay',
    Operator: 'Operator',
    FavoriteBlock: 'FavoriteBlock',
    Planning: 'Planning',
    HdbClient: 'HdbClient',
    TimeEntry: 'TimeEntry'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "project" | "clientDelay" | "operator" | "favoriteBlock" | "planning" | "hdbClient" | "timeEntry"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Project: {
        payload: Prisma.$ProjectPayload<ExtArgs>
        fields: Prisma.ProjectFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ProjectFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ProjectFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload>
          }
          findFirst: {
            args: Prisma.ProjectFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ProjectFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload>
          }
          findMany: {
            args: Prisma.ProjectFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload>[]
          }
          create: {
            args: Prisma.ProjectCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload>
          }
          createMany: {
            args: Prisma.ProjectCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ProjectCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload>[]
          }
          delete: {
            args: Prisma.ProjectDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload>
          }
          update: {
            args: Prisma.ProjectUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload>
          }
          deleteMany: {
            args: Prisma.ProjectDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ProjectUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ProjectUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProjectPayload>
          }
          aggregate: {
            args: Prisma.ProjectAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateProject>
          }
          groupBy: {
            args: Prisma.ProjectGroupByArgs<ExtArgs>
            result: $Utils.Optional<ProjectGroupByOutputType>[]
          }
          count: {
            args: Prisma.ProjectCountArgs<ExtArgs>
            result: $Utils.Optional<ProjectCountAggregateOutputType> | number
          }
        }
      }
      ClientDelay: {
        payload: Prisma.$ClientDelayPayload<ExtArgs>
        fields: Prisma.ClientDelayFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClientDelayFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClientDelayFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload>
          }
          findFirst: {
            args: Prisma.ClientDelayFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClientDelayFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload>
          }
          findMany: {
            args: Prisma.ClientDelayFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload>[]
          }
          create: {
            args: Prisma.ClientDelayCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload>
          }
          createMany: {
            args: Prisma.ClientDelayCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ClientDelayCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload>[]
          }
          delete: {
            args: Prisma.ClientDelayDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload>
          }
          update: {
            args: Prisma.ClientDelayUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload>
          }
          deleteMany: {
            args: Prisma.ClientDelayDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ClientDelayUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ClientDelayUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClientDelayPayload>
          }
          aggregate: {
            args: Prisma.ClientDelayAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateClientDelay>
          }
          groupBy: {
            args: Prisma.ClientDelayGroupByArgs<ExtArgs>
            result: $Utils.Optional<ClientDelayGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClientDelayCountArgs<ExtArgs>
            result: $Utils.Optional<ClientDelayCountAggregateOutputType> | number
          }
        }
      }
      Operator: {
        payload: Prisma.$OperatorPayload<ExtArgs>
        fields: Prisma.OperatorFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OperatorFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OperatorFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload>
          }
          findFirst: {
            args: Prisma.OperatorFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OperatorFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload>
          }
          findMany: {
            args: Prisma.OperatorFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload>[]
          }
          create: {
            args: Prisma.OperatorCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload>
          }
          createMany: {
            args: Prisma.OperatorCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.OperatorCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload>[]
          }
          delete: {
            args: Prisma.OperatorDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload>
          }
          update: {
            args: Prisma.OperatorUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload>
          }
          deleteMany: {
            args: Prisma.OperatorDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.OperatorUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.OperatorUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OperatorPayload>
          }
          aggregate: {
            args: Prisma.OperatorAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOperator>
          }
          groupBy: {
            args: Prisma.OperatorGroupByArgs<ExtArgs>
            result: $Utils.Optional<OperatorGroupByOutputType>[]
          }
          count: {
            args: Prisma.OperatorCountArgs<ExtArgs>
            result: $Utils.Optional<OperatorCountAggregateOutputType> | number
          }
        }
      }
      FavoriteBlock: {
        payload: Prisma.$FavoriteBlockPayload<ExtArgs>
        fields: Prisma.FavoriteBlockFieldRefs
        operations: {
          findUnique: {
            args: Prisma.FavoriteBlockFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.FavoriteBlockFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload>
          }
          findFirst: {
            args: Prisma.FavoriteBlockFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.FavoriteBlockFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload>
          }
          findMany: {
            args: Prisma.FavoriteBlockFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload>[]
          }
          create: {
            args: Prisma.FavoriteBlockCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload>
          }
          createMany: {
            args: Prisma.FavoriteBlockCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.FavoriteBlockCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload>[]
          }
          delete: {
            args: Prisma.FavoriteBlockDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload>
          }
          update: {
            args: Prisma.FavoriteBlockUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload>
          }
          deleteMany: {
            args: Prisma.FavoriteBlockDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.FavoriteBlockUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.FavoriteBlockUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FavoriteBlockPayload>
          }
          aggregate: {
            args: Prisma.FavoriteBlockAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateFavoriteBlock>
          }
          groupBy: {
            args: Prisma.FavoriteBlockGroupByArgs<ExtArgs>
            result: $Utils.Optional<FavoriteBlockGroupByOutputType>[]
          }
          count: {
            args: Prisma.FavoriteBlockCountArgs<ExtArgs>
            result: $Utils.Optional<FavoriteBlockCountAggregateOutputType> | number
          }
        }
      }
      Planning: {
        payload: Prisma.$PlanningPayload<ExtArgs>
        fields: Prisma.PlanningFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PlanningFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PlanningFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload>
          }
          findFirst: {
            args: Prisma.PlanningFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PlanningFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload>
          }
          findMany: {
            args: Prisma.PlanningFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload>[]
          }
          create: {
            args: Prisma.PlanningCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload>
          }
          createMany: {
            args: Prisma.PlanningCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PlanningCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload>[]
          }
          delete: {
            args: Prisma.PlanningDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload>
          }
          update: {
            args: Prisma.PlanningUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload>
          }
          deleteMany: {
            args: Prisma.PlanningDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PlanningUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PlanningUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanningPayload>
          }
          aggregate: {
            args: Prisma.PlanningAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePlanning>
          }
          groupBy: {
            args: Prisma.PlanningGroupByArgs<ExtArgs>
            result: $Utils.Optional<PlanningGroupByOutputType>[]
          }
          count: {
            args: Prisma.PlanningCountArgs<ExtArgs>
            result: $Utils.Optional<PlanningCountAggregateOutputType> | number
          }
        }
      }
      HdbClient: {
        payload: Prisma.$HdbClientPayload<ExtArgs>
        fields: Prisma.HdbClientFieldRefs
        operations: {
          findUnique: {
            args: Prisma.HdbClientFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.HdbClientFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload>
          }
          findFirst: {
            args: Prisma.HdbClientFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.HdbClientFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload>
          }
          findMany: {
            args: Prisma.HdbClientFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload>[]
          }
          create: {
            args: Prisma.HdbClientCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload>
          }
          createMany: {
            args: Prisma.HdbClientCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.HdbClientCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload>[]
          }
          delete: {
            args: Prisma.HdbClientDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload>
          }
          update: {
            args: Prisma.HdbClientUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload>
          }
          deleteMany: {
            args: Prisma.HdbClientDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.HdbClientUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.HdbClientUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HdbClientPayload>
          }
          aggregate: {
            args: Prisma.HdbClientAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateHdbClient>
          }
          groupBy: {
            args: Prisma.HdbClientGroupByArgs<ExtArgs>
            result: $Utils.Optional<HdbClientGroupByOutputType>[]
          }
          count: {
            args: Prisma.HdbClientCountArgs<ExtArgs>
            result: $Utils.Optional<HdbClientCountAggregateOutputType> | number
          }
        }
      }
      TimeEntry: {
        payload: Prisma.$TimeEntryPayload<ExtArgs>
        fields: Prisma.TimeEntryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TimeEntryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TimeEntryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload>
          }
          findFirst: {
            args: Prisma.TimeEntryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TimeEntryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload>
          }
          findMany: {
            args: Prisma.TimeEntryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload>[]
          }
          create: {
            args: Prisma.TimeEntryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload>
          }
          createMany: {
            args: Prisma.TimeEntryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TimeEntryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload>[]
          }
          delete: {
            args: Prisma.TimeEntryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload>
          }
          update: {
            args: Prisma.TimeEntryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload>
          }
          deleteMany: {
            args: Prisma.TimeEntryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TimeEntryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TimeEntryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TimeEntryPayload>
          }
          aggregate: {
            args: Prisma.TimeEntryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTimeEntry>
          }
          groupBy: {
            args: Prisma.TimeEntryGroupByArgs<ExtArgs>
            result: $Utils.Optional<TimeEntryGroupByOutputType>[]
          }
          count: {
            args: Prisma.TimeEntryCountArgs<ExtArgs>
            result: $Utils.Optional<TimeEntryCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type ProjectCountOutputType
   */

  export type ProjectCountOutputType = {
    clientDelays: number
    timeEntries: number
  }

  export type ProjectCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    clientDelays?: boolean | ProjectCountOutputTypeCountClientDelaysArgs
    timeEntries?: boolean | ProjectCountOutputTypeCountTimeEntriesArgs
  }

  // Custom InputTypes
  /**
   * ProjectCountOutputType without action
   */
  export type ProjectCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProjectCountOutputType
     */
    select?: ProjectCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ProjectCountOutputType without action
   */
  export type ProjectCountOutputTypeCountClientDelaysArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClientDelayWhereInput
  }

  /**
   * ProjectCountOutputType without action
   */
  export type ProjectCountOutputTypeCountTimeEntriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TimeEntryWhereInput
  }


  /**
   * Count Type OperatorCountOutputType
   */

  export type OperatorCountOutputType = {
    timeEntries: number
  }

  export type OperatorCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    timeEntries?: boolean | OperatorCountOutputTypeCountTimeEntriesArgs
  }

  // Custom InputTypes
  /**
   * OperatorCountOutputType without action
   */
  export type OperatorCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OperatorCountOutputType
     */
    select?: OperatorCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * OperatorCountOutputType without action
   */
  export type OperatorCountOutputTypeCountTimeEntriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TimeEntryWhereInput
  }


  /**
   * Count Type HdbClientCountOutputType
   */

  export type HdbClientCountOutputType = {
    projects: number
  }

  export type HdbClientCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    projects?: boolean | HdbClientCountOutputTypeCountProjectsArgs
  }

  // Custom InputTypes
  /**
   * HdbClientCountOutputType without action
   */
  export type HdbClientCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClientCountOutputType
     */
    select?: HdbClientCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * HdbClientCountOutputType without action
   */
  export type HdbClientCountOutputTypeCountProjectsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProjectWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Project
   */

  export type AggregateProject = {
    _count: ProjectCountAggregateOutputType | null
    _avg: ProjectAvgAggregateOutputType | null
    _sum: ProjectSumAggregateOutputType | null
    _min: ProjectMinAggregateOutputType | null
    _max: ProjectMaxAggregateOutputType | null
  }

  export type ProjectAvgAggregateOutputType = {
    horasEstimadas: number | null
    horasConsumidas: number | null
  }

  export type ProjectSumAggregateOutputType = {
    horasEstimadas: number | null
    horasConsumidas: number | null
  }

  export type ProjectMinAggregateOutputType = {
    id: string | null
    nombre: string | null
    activo: boolean | null
    observaciones: string | null
    horasEstimadas: number | null
    horasConsumidas: number | null
    cliente: string | null
    clientId: string | null
    responsable: string | null
    estado: string | null
    fechaInicio: string | null
    fechaFin: string | null
    createdAt: Date | null
  }

  export type ProjectMaxAggregateOutputType = {
    id: string | null
    nombre: string | null
    activo: boolean | null
    observaciones: string | null
    horasEstimadas: number | null
    horasConsumidas: number | null
    cliente: string | null
    clientId: string | null
    responsable: string | null
    estado: string | null
    fechaInicio: string | null
    fechaFin: string | null
    createdAt: Date | null
  }

  export type ProjectCountAggregateOutputType = {
    id: number
    nombre: number
    activo: number
    observaciones: number
    horasEstimadas: number
    horasConsumidas: number
    cliente: number
    clientId: number
    responsable: number
    estado: number
    fechaInicio: number
    fechaFin: number
    createdAt: number
    _all: number
  }


  export type ProjectAvgAggregateInputType = {
    horasEstimadas?: true
    horasConsumidas?: true
  }

  export type ProjectSumAggregateInputType = {
    horasEstimadas?: true
    horasConsumidas?: true
  }

  export type ProjectMinAggregateInputType = {
    id?: true
    nombre?: true
    activo?: true
    observaciones?: true
    horasEstimadas?: true
    horasConsumidas?: true
    cliente?: true
    clientId?: true
    responsable?: true
    estado?: true
    fechaInicio?: true
    fechaFin?: true
    createdAt?: true
  }

  export type ProjectMaxAggregateInputType = {
    id?: true
    nombre?: true
    activo?: true
    observaciones?: true
    horasEstimadas?: true
    horasConsumidas?: true
    cliente?: true
    clientId?: true
    responsable?: true
    estado?: true
    fechaInicio?: true
    fechaFin?: true
    createdAt?: true
  }

  export type ProjectCountAggregateInputType = {
    id?: true
    nombre?: true
    activo?: true
    observaciones?: true
    horasEstimadas?: true
    horasConsumidas?: true
    cliente?: true
    clientId?: true
    responsable?: true
    estado?: true
    fechaInicio?: true
    fechaFin?: true
    createdAt?: true
    _all?: true
  }

  export type ProjectAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Project to aggregate.
     */
    where?: ProjectWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Projects to fetch.
     */
    orderBy?: ProjectOrderByWithRelationInput | ProjectOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ProjectWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Projects from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Projects.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Projects
    **/
    _count?: true | ProjectCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ProjectAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ProjectSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ProjectMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ProjectMaxAggregateInputType
  }

  export type GetProjectAggregateType<T extends ProjectAggregateArgs> = {
        [P in keyof T & keyof AggregateProject]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateProject[P]>
      : GetScalarType<T[P], AggregateProject[P]>
  }




  export type ProjectGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProjectWhereInput
    orderBy?: ProjectOrderByWithAggregationInput | ProjectOrderByWithAggregationInput[]
    by: ProjectScalarFieldEnum[] | ProjectScalarFieldEnum
    having?: ProjectScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ProjectCountAggregateInputType | true
    _avg?: ProjectAvgAggregateInputType
    _sum?: ProjectSumAggregateInputType
    _min?: ProjectMinAggregateInputType
    _max?: ProjectMaxAggregateInputType
  }

  export type ProjectGroupByOutputType = {
    id: string
    nombre: string
    activo: boolean
    observaciones: string | null
    horasEstimadas: number
    horasConsumidas: number
    cliente: string | null
    clientId: string | null
    responsable: string | null
    estado: string
    fechaInicio: string | null
    fechaFin: string | null
    createdAt: Date
    _count: ProjectCountAggregateOutputType | null
    _avg: ProjectAvgAggregateOutputType | null
    _sum: ProjectSumAggregateOutputType | null
    _min: ProjectMinAggregateOutputType | null
    _max: ProjectMaxAggregateOutputType | null
  }

  type GetProjectGroupByPayload<T extends ProjectGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ProjectGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ProjectGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ProjectGroupByOutputType[P]>
            : GetScalarType<T[P], ProjectGroupByOutputType[P]>
        }
      >
    >


  export type ProjectSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nombre?: boolean
    activo?: boolean
    observaciones?: boolean
    horasEstimadas?: boolean
    horasConsumidas?: boolean
    cliente?: boolean
    clientId?: boolean
    responsable?: boolean
    estado?: boolean
    fechaInicio?: boolean
    fechaFin?: boolean
    createdAt?: boolean
    client?: boolean | Project$clientArgs<ExtArgs>
    clientDelays?: boolean | Project$clientDelaysArgs<ExtArgs>
    timeEntries?: boolean | Project$timeEntriesArgs<ExtArgs>
    _count?: boolean | ProjectCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["project"]>

  export type ProjectSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nombre?: boolean
    activo?: boolean
    observaciones?: boolean
    horasEstimadas?: boolean
    horasConsumidas?: boolean
    cliente?: boolean
    clientId?: boolean
    responsable?: boolean
    estado?: boolean
    fechaInicio?: boolean
    fechaFin?: boolean
    createdAt?: boolean
    client?: boolean | Project$clientArgs<ExtArgs>
  }, ExtArgs["result"]["project"]>

  export type ProjectSelectScalar = {
    id?: boolean
    nombre?: boolean
    activo?: boolean
    observaciones?: boolean
    horasEstimadas?: boolean
    horasConsumidas?: boolean
    cliente?: boolean
    clientId?: boolean
    responsable?: boolean
    estado?: boolean
    fechaInicio?: boolean
    fechaFin?: boolean
    createdAt?: boolean
  }

  export type ProjectInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    client?: boolean | Project$clientArgs<ExtArgs>
    clientDelays?: boolean | Project$clientDelaysArgs<ExtArgs>
    timeEntries?: boolean | Project$timeEntriesArgs<ExtArgs>
    _count?: boolean | ProjectCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ProjectIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    client?: boolean | Project$clientArgs<ExtArgs>
  }

  export type $ProjectPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Project"
    objects: {
      client: Prisma.$HdbClientPayload<ExtArgs> | null
      clientDelays: Prisma.$ClientDelayPayload<ExtArgs>[]
      timeEntries: Prisma.$TimeEntryPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      nombre: string
      activo: boolean
      observaciones: string | null
      horasEstimadas: number
      horasConsumidas: number
      cliente: string | null
      clientId: string | null
      responsable: string | null
      estado: string
      fechaInicio: string | null
      fechaFin: string | null
      createdAt: Date
    }, ExtArgs["result"]["project"]>
    composites: {}
  }

  type ProjectGetPayload<S extends boolean | null | undefined | ProjectDefaultArgs> = $Result.GetResult<Prisma.$ProjectPayload, S>

  type ProjectCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ProjectFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ProjectCountAggregateInputType | true
    }

  export interface ProjectDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Project'], meta: { name: 'Project' } }
    /**
     * Find zero or one Project that matches the filter.
     * @param {ProjectFindUniqueArgs} args - Arguments to find a Project
     * @example
     * // Get one Project
     * const project = await prisma.project.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ProjectFindUniqueArgs>(args: SelectSubset<T, ProjectFindUniqueArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Project that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ProjectFindUniqueOrThrowArgs} args - Arguments to find a Project
     * @example
     * // Get one Project
     * const project = await prisma.project.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ProjectFindUniqueOrThrowArgs>(args: SelectSubset<T, ProjectFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Project that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProjectFindFirstArgs} args - Arguments to find a Project
     * @example
     * // Get one Project
     * const project = await prisma.project.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ProjectFindFirstArgs>(args?: SelectSubset<T, ProjectFindFirstArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Project that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProjectFindFirstOrThrowArgs} args - Arguments to find a Project
     * @example
     * // Get one Project
     * const project = await prisma.project.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ProjectFindFirstOrThrowArgs>(args?: SelectSubset<T, ProjectFindFirstOrThrowArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Projects that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProjectFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Projects
     * const projects = await prisma.project.findMany()
     * 
     * // Get first 10 Projects
     * const projects = await prisma.project.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const projectWithIdOnly = await prisma.project.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ProjectFindManyArgs>(args?: SelectSubset<T, ProjectFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Project.
     * @param {ProjectCreateArgs} args - Arguments to create a Project.
     * @example
     * // Create one Project
     * const Project = await prisma.project.create({
     *   data: {
     *     // ... data to create a Project
     *   }
     * })
     * 
     */
    create<T extends ProjectCreateArgs>(args: SelectSubset<T, ProjectCreateArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Projects.
     * @param {ProjectCreateManyArgs} args - Arguments to create many Projects.
     * @example
     * // Create many Projects
     * const project = await prisma.project.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ProjectCreateManyArgs>(args?: SelectSubset<T, ProjectCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Projects and returns the data saved in the database.
     * @param {ProjectCreateManyAndReturnArgs} args - Arguments to create many Projects.
     * @example
     * // Create many Projects
     * const project = await prisma.project.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Projects and only return the `id`
     * const projectWithIdOnly = await prisma.project.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ProjectCreateManyAndReturnArgs>(args?: SelectSubset<T, ProjectCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Project.
     * @param {ProjectDeleteArgs} args - Arguments to delete one Project.
     * @example
     * // Delete one Project
     * const Project = await prisma.project.delete({
     *   where: {
     *     // ... filter to delete one Project
     *   }
     * })
     * 
     */
    delete<T extends ProjectDeleteArgs>(args: SelectSubset<T, ProjectDeleteArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Project.
     * @param {ProjectUpdateArgs} args - Arguments to update one Project.
     * @example
     * // Update one Project
     * const project = await prisma.project.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ProjectUpdateArgs>(args: SelectSubset<T, ProjectUpdateArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Projects.
     * @param {ProjectDeleteManyArgs} args - Arguments to filter Projects to delete.
     * @example
     * // Delete a few Projects
     * const { count } = await prisma.project.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ProjectDeleteManyArgs>(args?: SelectSubset<T, ProjectDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Projects.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProjectUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Projects
     * const project = await prisma.project.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ProjectUpdateManyArgs>(args: SelectSubset<T, ProjectUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Project.
     * @param {ProjectUpsertArgs} args - Arguments to update or create a Project.
     * @example
     * // Update or create a Project
     * const project = await prisma.project.upsert({
     *   create: {
     *     // ... data to create a Project
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Project we want to update
     *   }
     * })
     */
    upsert<T extends ProjectUpsertArgs>(args: SelectSubset<T, ProjectUpsertArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Projects.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProjectCountArgs} args - Arguments to filter Projects to count.
     * @example
     * // Count the number of Projects
     * const count = await prisma.project.count({
     *   where: {
     *     // ... the filter for the Projects we want to count
     *   }
     * })
    **/
    count<T extends ProjectCountArgs>(
      args?: Subset<T, ProjectCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ProjectCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Project.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProjectAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ProjectAggregateArgs>(args: Subset<T, ProjectAggregateArgs>): Prisma.PrismaPromise<GetProjectAggregateType<T>>

    /**
     * Group by Project.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProjectGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ProjectGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ProjectGroupByArgs['orderBy'] }
        : { orderBy?: ProjectGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ProjectGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetProjectGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Project model
   */
  readonly fields: ProjectFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Project.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ProjectClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    client<T extends Project$clientArgs<ExtArgs> = {}>(args?: Subset<T, Project$clientArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    clientDelays<T extends Project$clientDelaysArgs<ExtArgs> = {}>(args?: Subset<T, Project$clientDelaysArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "findMany"> | Null>
    timeEntries<T extends Project$timeEntriesArgs<ExtArgs> = {}>(args?: Subset<T, Project$timeEntriesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Project model
   */ 
  interface ProjectFieldRefs {
    readonly id: FieldRef<"Project", 'String'>
    readonly nombre: FieldRef<"Project", 'String'>
    readonly activo: FieldRef<"Project", 'Boolean'>
    readonly observaciones: FieldRef<"Project", 'String'>
    readonly horasEstimadas: FieldRef<"Project", 'Int'>
    readonly horasConsumidas: FieldRef<"Project", 'Int'>
    readonly cliente: FieldRef<"Project", 'String'>
    readonly clientId: FieldRef<"Project", 'String'>
    readonly responsable: FieldRef<"Project", 'String'>
    readonly estado: FieldRef<"Project", 'String'>
    readonly fechaInicio: FieldRef<"Project", 'String'>
    readonly fechaFin: FieldRef<"Project", 'String'>
    readonly createdAt: FieldRef<"Project", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Project findUnique
   */
  export type ProjectFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * Filter, which Project to fetch.
     */
    where: ProjectWhereUniqueInput
  }

  /**
   * Project findUniqueOrThrow
   */
  export type ProjectFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * Filter, which Project to fetch.
     */
    where: ProjectWhereUniqueInput
  }

  /**
   * Project findFirst
   */
  export type ProjectFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * Filter, which Project to fetch.
     */
    where?: ProjectWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Projects to fetch.
     */
    orderBy?: ProjectOrderByWithRelationInput | ProjectOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Projects.
     */
    cursor?: ProjectWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Projects from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Projects.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Projects.
     */
    distinct?: ProjectScalarFieldEnum | ProjectScalarFieldEnum[]
  }

  /**
   * Project findFirstOrThrow
   */
  export type ProjectFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * Filter, which Project to fetch.
     */
    where?: ProjectWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Projects to fetch.
     */
    orderBy?: ProjectOrderByWithRelationInput | ProjectOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Projects.
     */
    cursor?: ProjectWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Projects from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Projects.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Projects.
     */
    distinct?: ProjectScalarFieldEnum | ProjectScalarFieldEnum[]
  }

  /**
   * Project findMany
   */
  export type ProjectFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * Filter, which Projects to fetch.
     */
    where?: ProjectWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Projects to fetch.
     */
    orderBy?: ProjectOrderByWithRelationInput | ProjectOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Projects.
     */
    cursor?: ProjectWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Projects from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Projects.
     */
    skip?: number
    distinct?: ProjectScalarFieldEnum | ProjectScalarFieldEnum[]
  }

  /**
   * Project create
   */
  export type ProjectCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * The data needed to create a Project.
     */
    data: XOR<ProjectCreateInput, ProjectUncheckedCreateInput>
  }

  /**
   * Project createMany
   */
  export type ProjectCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Projects.
     */
    data: ProjectCreateManyInput | ProjectCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Project createManyAndReturn
   */
  export type ProjectCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Projects.
     */
    data: ProjectCreateManyInput | ProjectCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Project update
   */
  export type ProjectUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * The data needed to update a Project.
     */
    data: XOR<ProjectUpdateInput, ProjectUncheckedUpdateInput>
    /**
     * Choose, which Project to update.
     */
    where: ProjectWhereUniqueInput
  }

  /**
   * Project updateMany
   */
  export type ProjectUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Projects.
     */
    data: XOR<ProjectUpdateManyMutationInput, ProjectUncheckedUpdateManyInput>
    /**
     * Filter which Projects to update
     */
    where?: ProjectWhereInput
  }

  /**
   * Project upsert
   */
  export type ProjectUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * The filter to search for the Project to update in case it exists.
     */
    where: ProjectWhereUniqueInput
    /**
     * In case the Project found by the `where` argument doesn't exist, create a new Project with this data.
     */
    create: XOR<ProjectCreateInput, ProjectUncheckedCreateInput>
    /**
     * In case the Project was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ProjectUpdateInput, ProjectUncheckedUpdateInput>
  }

  /**
   * Project delete
   */
  export type ProjectDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    /**
     * Filter which Project to delete.
     */
    where: ProjectWhereUniqueInput
  }

  /**
   * Project deleteMany
   */
  export type ProjectDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Projects to delete
     */
    where?: ProjectWhereInput
  }

  /**
   * Project.client
   */
  export type Project$clientArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    where?: HdbClientWhereInput
  }

  /**
   * Project.clientDelays
   */
  export type Project$clientDelaysArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    where?: ClientDelayWhereInput
    orderBy?: ClientDelayOrderByWithRelationInput | ClientDelayOrderByWithRelationInput[]
    cursor?: ClientDelayWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClientDelayScalarFieldEnum | ClientDelayScalarFieldEnum[]
  }

  /**
   * Project.timeEntries
   */
  export type Project$timeEntriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    where?: TimeEntryWhereInput
    orderBy?: TimeEntryOrderByWithRelationInput | TimeEntryOrderByWithRelationInput[]
    cursor?: TimeEntryWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TimeEntryScalarFieldEnum | TimeEntryScalarFieldEnum[]
  }

  /**
   * Project without action
   */
  export type ProjectDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
  }


  /**
   * Model ClientDelay
   */

  export type AggregateClientDelay = {
    _count: ClientDelayCountAggregateOutputType | null
    _avg: ClientDelayAvgAggregateOutputType | null
    _sum: ClientDelaySumAggregateOutputType | null
    _min: ClientDelayMinAggregateOutputType | null
    _max: ClientDelayMaxAggregateOutputType | null
  }

  export type ClientDelayAvgAggregateOutputType = {
    duracion: number | null
  }

  export type ClientDelaySumAggregateOutputType = {
    duracion: number | null
  }

  export type ClientDelayMinAggregateOutputType = {
    id: string | null
    projectId: string | null
    fecha: string | null
    hora: string | null
    operador: string | null
    area: string | null
    motivo: string | null
    duracion: number | null
    createdAt: Date | null
  }

  export type ClientDelayMaxAggregateOutputType = {
    id: string | null
    projectId: string | null
    fecha: string | null
    hora: string | null
    operador: string | null
    area: string | null
    motivo: string | null
    duracion: number | null
    createdAt: Date | null
  }

  export type ClientDelayCountAggregateOutputType = {
    id: number
    projectId: number
    fecha: number
    hora: number
    operador: number
    area: number
    motivo: number
    duracion: number
    createdAt: number
    _all: number
  }


  export type ClientDelayAvgAggregateInputType = {
    duracion?: true
  }

  export type ClientDelaySumAggregateInputType = {
    duracion?: true
  }

  export type ClientDelayMinAggregateInputType = {
    id?: true
    projectId?: true
    fecha?: true
    hora?: true
    operador?: true
    area?: true
    motivo?: true
    duracion?: true
    createdAt?: true
  }

  export type ClientDelayMaxAggregateInputType = {
    id?: true
    projectId?: true
    fecha?: true
    hora?: true
    operador?: true
    area?: true
    motivo?: true
    duracion?: true
    createdAt?: true
  }

  export type ClientDelayCountAggregateInputType = {
    id?: true
    projectId?: true
    fecha?: true
    hora?: true
    operador?: true
    area?: true
    motivo?: true
    duracion?: true
    createdAt?: true
    _all?: true
  }

  export type ClientDelayAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClientDelay to aggregate.
     */
    where?: ClientDelayWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClientDelays to fetch.
     */
    orderBy?: ClientDelayOrderByWithRelationInput | ClientDelayOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClientDelayWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClientDelays from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClientDelays.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ClientDelays
    **/
    _count?: true | ClientDelayCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ClientDelayAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ClientDelaySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClientDelayMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClientDelayMaxAggregateInputType
  }

  export type GetClientDelayAggregateType<T extends ClientDelayAggregateArgs> = {
        [P in keyof T & keyof AggregateClientDelay]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClientDelay[P]>
      : GetScalarType<T[P], AggregateClientDelay[P]>
  }




  export type ClientDelayGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClientDelayWhereInput
    orderBy?: ClientDelayOrderByWithAggregationInput | ClientDelayOrderByWithAggregationInput[]
    by: ClientDelayScalarFieldEnum[] | ClientDelayScalarFieldEnum
    having?: ClientDelayScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClientDelayCountAggregateInputType | true
    _avg?: ClientDelayAvgAggregateInputType
    _sum?: ClientDelaySumAggregateInputType
    _min?: ClientDelayMinAggregateInputType
    _max?: ClientDelayMaxAggregateInputType
  }

  export type ClientDelayGroupByOutputType = {
    id: string
    projectId: string
    fecha: string
    hora: string
    operador: string
    area: string
    motivo: string
    duracion: number
    createdAt: Date
    _count: ClientDelayCountAggregateOutputType | null
    _avg: ClientDelayAvgAggregateOutputType | null
    _sum: ClientDelaySumAggregateOutputType | null
    _min: ClientDelayMinAggregateOutputType | null
    _max: ClientDelayMaxAggregateOutputType | null
  }

  type GetClientDelayGroupByPayload<T extends ClientDelayGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClientDelayGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClientDelayGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClientDelayGroupByOutputType[P]>
            : GetScalarType<T[P], ClientDelayGroupByOutputType[P]>
        }
      >
    >


  export type ClientDelaySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    projectId?: boolean
    fecha?: boolean
    hora?: boolean
    operador?: boolean
    area?: boolean
    motivo?: boolean
    duracion?: boolean
    createdAt?: boolean
    project?: boolean | ProjectDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["clientDelay"]>

  export type ClientDelaySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    projectId?: boolean
    fecha?: boolean
    hora?: boolean
    operador?: boolean
    area?: boolean
    motivo?: boolean
    duracion?: boolean
    createdAt?: boolean
    project?: boolean | ProjectDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["clientDelay"]>

  export type ClientDelaySelectScalar = {
    id?: boolean
    projectId?: boolean
    fecha?: boolean
    hora?: boolean
    operador?: boolean
    area?: boolean
    motivo?: boolean
    duracion?: boolean
    createdAt?: boolean
  }

  export type ClientDelayInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    project?: boolean | ProjectDefaultArgs<ExtArgs>
  }
  export type ClientDelayIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    project?: boolean | ProjectDefaultArgs<ExtArgs>
  }

  export type $ClientDelayPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ClientDelay"
    objects: {
      project: Prisma.$ProjectPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      projectId: string
      fecha: string
      hora: string
      operador: string
      area: string
      motivo: string
      duracion: number
      createdAt: Date
    }, ExtArgs["result"]["clientDelay"]>
    composites: {}
  }

  type ClientDelayGetPayload<S extends boolean | null | undefined | ClientDelayDefaultArgs> = $Result.GetResult<Prisma.$ClientDelayPayload, S>

  type ClientDelayCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ClientDelayFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ClientDelayCountAggregateInputType | true
    }

  export interface ClientDelayDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ClientDelay'], meta: { name: 'ClientDelay' } }
    /**
     * Find zero or one ClientDelay that matches the filter.
     * @param {ClientDelayFindUniqueArgs} args - Arguments to find a ClientDelay
     * @example
     * // Get one ClientDelay
     * const clientDelay = await prisma.clientDelay.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ClientDelayFindUniqueArgs>(args: SelectSubset<T, ClientDelayFindUniqueArgs<ExtArgs>>): Prisma__ClientDelayClient<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ClientDelay that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ClientDelayFindUniqueOrThrowArgs} args - Arguments to find a ClientDelay
     * @example
     * // Get one ClientDelay
     * const clientDelay = await prisma.clientDelay.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ClientDelayFindUniqueOrThrowArgs>(args: SelectSubset<T, ClientDelayFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ClientDelayClient<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ClientDelay that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientDelayFindFirstArgs} args - Arguments to find a ClientDelay
     * @example
     * // Get one ClientDelay
     * const clientDelay = await prisma.clientDelay.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ClientDelayFindFirstArgs>(args?: SelectSubset<T, ClientDelayFindFirstArgs<ExtArgs>>): Prisma__ClientDelayClient<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ClientDelay that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientDelayFindFirstOrThrowArgs} args - Arguments to find a ClientDelay
     * @example
     * // Get one ClientDelay
     * const clientDelay = await prisma.clientDelay.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ClientDelayFindFirstOrThrowArgs>(args?: SelectSubset<T, ClientDelayFindFirstOrThrowArgs<ExtArgs>>): Prisma__ClientDelayClient<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ClientDelays that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientDelayFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ClientDelays
     * const clientDelays = await prisma.clientDelay.findMany()
     * 
     * // Get first 10 ClientDelays
     * const clientDelays = await prisma.clientDelay.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const clientDelayWithIdOnly = await prisma.clientDelay.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ClientDelayFindManyArgs>(args?: SelectSubset<T, ClientDelayFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ClientDelay.
     * @param {ClientDelayCreateArgs} args - Arguments to create a ClientDelay.
     * @example
     * // Create one ClientDelay
     * const ClientDelay = await prisma.clientDelay.create({
     *   data: {
     *     // ... data to create a ClientDelay
     *   }
     * })
     * 
     */
    create<T extends ClientDelayCreateArgs>(args: SelectSubset<T, ClientDelayCreateArgs<ExtArgs>>): Prisma__ClientDelayClient<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ClientDelays.
     * @param {ClientDelayCreateManyArgs} args - Arguments to create many ClientDelays.
     * @example
     * // Create many ClientDelays
     * const clientDelay = await prisma.clientDelay.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ClientDelayCreateManyArgs>(args?: SelectSubset<T, ClientDelayCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ClientDelays and returns the data saved in the database.
     * @param {ClientDelayCreateManyAndReturnArgs} args - Arguments to create many ClientDelays.
     * @example
     * // Create many ClientDelays
     * const clientDelay = await prisma.clientDelay.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ClientDelays and only return the `id`
     * const clientDelayWithIdOnly = await prisma.clientDelay.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ClientDelayCreateManyAndReturnArgs>(args?: SelectSubset<T, ClientDelayCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ClientDelay.
     * @param {ClientDelayDeleteArgs} args - Arguments to delete one ClientDelay.
     * @example
     * // Delete one ClientDelay
     * const ClientDelay = await prisma.clientDelay.delete({
     *   where: {
     *     // ... filter to delete one ClientDelay
     *   }
     * })
     * 
     */
    delete<T extends ClientDelayDeleteArgs>(args: SelectSubset<T, ClientDelayDeleteArgs<ExtArgs>>): Prisma__ClientDelayClient<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ClientDelay.
     * @param {ClientDelayUpdateArgs} args - Arguments to update one ClientDelay.
     * @example
     * // Update one ClientDelay
     * const clientDelay = await prisma.clientDelay.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ClientDelayUpdateArgs>(args: SelectSubset<T, ClientDelayUpdateArgs<ExtArgs>>): Prisma__ClientDelayClient<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ClientDelays.
     * @param {ClientDelayDeleteManyArgs} args - Arguments to filter ClientDelays to delete.
     * @example
     * // Delete a few ClientDelays
     * const { count } = await prisma.clientDelay.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ClientDelayDeleteManyArgs>(args?: SelectSubset<T, ClientDelayDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClientDelays.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientDelayUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ClientDelays
     * const clientDelay = await prisma.clientDelay.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ClientDelayUpdateManyArgs>(args: SelectSubset<T, ClientDelayUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ClientDelay.
     * @param {ClientDelayUpsertArgs} args - Arguments to update or create a ClientDelay.
     * @example
     * // Update or create a ClientDelay
     * const clientDelay = await prisma.clientDelay.upsert({
     *   create: {
     *     // ... data to create a ClientDelay
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ClientDelay we want to update
     *   }
     * })
     */
    upsert<T extends ClientDelayUpsertArgs>(args: SelectSubset<T, ClientDelayUpsertArgs<ExtArgs>>): Prisma__ClientDelayClient<$Result.GetResult<Prisma.$ClientDelayPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ClientDelays.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientDelayCountArgs} args - Arguments to filter ClientDelays to count.
     * @example
     * // Count the number of ClientDelays
     * const count = await prisma.clientDelay.count({
     *   where: {
     *     // ... the filter for the ClientDelays we want to count
     *   }
     * })
    **/
    count<T extends ClientDelayCountArgs>(
      args?: Subset<T, ClientDelayCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClientDelayCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ClientDelay.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientDelayAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClientDelayAggregateArgs>(args: Subset<T, ClientDelayAggregateArgs>): Prisma.PrismaPromise<GetClientDelayAggregateType<T>>

    /**
     * Group by ClientDelay.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientDelayGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClientDelayGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClientDelayGroupByArgs['orderBy'] }
        : { orderBy?: ClientDelayGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClientDelayGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClientDelayGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ClientDelay model
   */
  readonly fields: ClientDelayFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ClientDelay.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClientDelayClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    project<T extends ProjectDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ProjectDefaultArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ClientDelay model
   */ 
  interface ClientDelayFieldRefs {
    readonly id: FieldRef<"ClientDelay", 'String'>
    readonly projectId: FieldRef<"ClientDelay", 'String'>
    readonly fecha: FieldRef<"ClientDelay", 'String'>
    readonly hora: FieldRef<"ClientDelay", 'String'>
    readonly operador: FieldRef<"ClientDelay", 'String'>
    readonly area: FieldRef<"ClientDelay", 'String'>
    readonly motivo: FieldRef<"ClientDelay", 'String'>
    readonly duracion: FieldRef<"ClientDelay", 'Float'>
    readonly createdAt: FieldRef<"ClientDelay", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ClientDelay findUnique
   */
  export type ClientDelayFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * Filter, which ClientDelay to fetch.
     */
    where: ClientDelayWhereUniqueInput
  }

  /**
   * ClientDelay findUniqueOrThrow
   */
  export type ClientDelayFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * Filter, which ClientDelay to fetch.
     */
    where: ClientDelayWhereUniqueInput
  }

  /**
   * ClientDelay findFirst
   */
  export type ClientDelayFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * Filter, which ClientDelay to fetch.
     */
    where?: ClientDelayWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClientDelays to fetch.
     */
    orderBy?: ClientDelayOrderByWithRelationInput | ClientDelayOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClientDelays.
     */
    cursor?: ClientDelayWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClientDelays from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClientDelays.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClientDelays.
     */
    distinct?: ClientDelayScalarFieldEnum | ClientDelayScalarFieldEnum[]
  }

  /**
   * ClientDelay findFirstOrThrow
   */
  export type ClientDelayFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * Filter, which ClientDelay to fetch.
     */
    where?: ClientDelayWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClientDelays to fetch.
     */
    orderBy?: ClientDelayOrderByWithRelationInput | ClientDelayOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClientDelays.
     */
    cursor?: ClientDelayWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClientDelays from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClientDelays.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClientDelays.
     */
    distinct?: ClientDelayScalarFieldEnum | ClientDelayScalarFieldEnum[]
  }

  /**
   * ClientDelay findMany
   */
  export type ClientDelayFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * Filter, which ClientDelays to fetch.
     */
    where?: ClientDelayWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClientDelays to fetch.
     */
    orderBy?: ClientDelayOrderByWithRelationInput | ClientDelayOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ClientDelays.
     */
    cursor?: ClientDelayWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClientDelays from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClientDelays.
     */
    skip?: number
    distinct?: ClientDelayScalarFieldEnum | ClientDelayScalarFieldEnum[]
  }

  /**
   * ClientDelay create
   */
  export type ClientDelayCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * The data needed to create a ClientDelay.
     */
    data: XOR<ClientDelayCreateInput, ClientDelayUncheckedCreateInput>
  }

  /**
   * ClientDelay createMany
   */
  export type ClientDelayCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ClientDelays.
     */
    data: ClientDelayCreateManyInput | ClientDelayCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ClientDelay createManyAndReturn
   */
  export type ClientDelayCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ClientDelays.
     */
    data: ClientDelayCreateManyInput | ClientDelayCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ClientDelay update
   */
  export type ClientDelayUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * The data needed to update a ClientDelay.
     */
    data: XOR<ClientDelayUpdateInput, ClientDelayUncheckedUpdateInput>
    /**
     * Choose, which ClientDelay to update.
     */
    where: ClientDelayWhereUniqueInput
  }

  /**
   * ClientDelay updateMany
   */
  export type ClientDelayUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ClientDelays.
     */
    data: XOR<ClientDelayUpdateManyMutationInput, ClientDelayUncheckedUpdateManyInput>
    /**
     * Filter which ClientDelays to update
     */
    where?: ClientDelayWhereInput
  }

  /**
   * ClientDelay upsert
   */
  export type ClientDelayUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * The filter to search for the ClientDelay to update in case it exists.
     */
    where: ClientDelayWhereUniqueInput
    /**
     * In case the ClientDelay found by the `where` argument doesn't exist, create a new ClientDelay with this data.
     */
    create: XOR<ClientDelayCreateInput, ClientDelayUncheckedCreateInput>
    /**
     * In case the ClientDelay was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClientDelayUpdateInput, ClientDelayUncheckedUpdateInput>
  }

  /**
   * ClientDelay delete
   */
  export type ClientDelayDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
    /**
     * Filter which ClientDelay to delete.
     */
    where: ClientDelayWhereUniqueInput
  }

  /**
   * ClientDelay deleteMany
   */
  export type ClientDelayDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClientDelays to delete
     */
    where?: ClientDelayWhereInput
  }

  /**
   * ClientDelay without action
   */
  export type ClientDelayDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientDelay
     */
    select?: ClientDelaySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClientDelayInclude<ExtArgs> | null
  }


  /**
   * Model Operator
   */

  export type AggregateOperator = {
    _count: OperatorCountAggregateOutputType | null
    _min: OperatorMinAggregateOutputType | null
    _max: OperatorMaxAggregateOutputType | null
  }

  export type OperatorMinAggregateOutputType = {
    id: string | null
    nombreCompleto: string | null
    activo: boolean | null
    pin: string | null
    role: string | null
    createdAt: Date | null
  }

  export type OperatorMaxAggregateOutputType = {
    id: string | null
    nombreCompleto: string | null
    activo: boolean | null
    pin: string | null
    role: string | null
    createdAt: Date | null
  }

  export type OperatorCountAggregateOutputType = {
    id: number
    nombreCompleto: number
    activo: number
    etiquetas: number
    pin: number
    role: number
    createdAt: number
    _all: number
  }


  export type OperatorMinAggregateInputType = {
    id?: true
    nombreCompleto?: true
    activo?: true
    pin?: true
    role?: true
    createdAt?: true
  }

  export type OperatorMaxAggregateInputType = {
    id?: true
    nombreCompleto?: true
    activo?: true
    pin?: true
    role?: true
    createdAt?: true
  }

  export type OperatorCountAggregateInputType = {
    id?: true
    nombreCompleto?: true
    activo?: true
    etiquetas?: true
    pin?: true
    role?: true
    createdAt?: true
    _all?: true
  }

  export type OperatorAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Operator to aggregate.
     */
    where?: OperatorWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Operators to fetch.
     */
    orderBy?: OperatorOrderByWithRelationInput | OperatorOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OperatorWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Operators from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Operators.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Operators
    **/
    _count?: true | OperatorCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OperatorMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OperatorMaxAggregateInputType
  }

  export type GetOperatorAggregateType<T extends OperatorAggregateArgs> = {
        [P in keyof T & keyof AggregateOperator]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOperator[P]>
      : GetScalarType<T[P], AggregateOperator[P]>
  }




  export type OperatorGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OperatorWhereInput
    orderBy?: OperatorOrderByWithAggregationInput | OperatorOrderByWithAggregationInput[]
    by: OperatorScalarFieldEnum[] | OperatorScalarFieldEnum
    having?: OperatorScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OperatorCountAggregateInputType | true
    _min?: OperatorMinAggregateInputType
    _max?: OperatorMaxAggregateInputType
  }

  export type OperatorGroupByOutputType = {
    id: string
    nombreCompleto: string
    activo: boolean
    etiquetas: JsonValue
    pin: string
    role: string
    createdAt: Date
    _count: OperatorCountAggregateOutputType | null
    _min: OperatorMinAggregateOutputType | null
    _max: OperatorMaxAggregateOutputType | null
  }

  type GetOperatorGroupByPayload<T extends OperatorGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OperatorGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OperatorGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OperatorGroupByOutputType[P]>
            : GetScalarType<T[P], OperatorGroupByOutputType[P]>
        }
      >
    >


  export type OperatorSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nombreCompleto?: boolean
    activo?: boolean
    etiquetas?: boolean
    pin?: boolean
    role?: boolean
    createdAt?: boolean
    timeEntries?: boolean | Operator$timeEntriesArgs<ExtArgs>
    _count?: boolean | OperatorCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["operator"]>

  export type OperatorSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nombreCompleto?: boolean
    activo?: boolean
    etiquetas?: boolean
    pin?: boolean
    role?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["operator"]>

  export type OperatorSelectScalar = {
    id?: boolean
    nombreCompleto?: boolean
    activo?: boolean
    etiquetas?: boolean
    pin?: boolean
    role?: boolean
    createdAt?: boolean
  }

  export type OperatorInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    timeEntries?: boolean | Operator$timeEntriesArgs<ExtArgs>
    _count?: boolean | OperatorCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type OperatorIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $OperatorPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Operator"
    objects: {
      timeEntries: Prisma.$TimeEntryPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      nombreCompleto: string
      activo: boolean
      etiquetas: Prisma.JsonValue
      pin: string
      role: string
      createdAt: Date
    }, ExtArgs["result"]["operator"]>
    composites: {}
  }

  type OperatorGetPayload<S extends boolean | null | undefined | OperatorDefaultArgs> = $Result.GetResult<Prisma.$OperatorPayload, S>

  type OperatorCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<OperatorFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: OperatorCountAggregateInputType | true
    }

  export interface OperatorDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Operator'], meta: { name: 'Operator' } }
    /**
     * Find zero or one Operator that matches the filter.
     * @param {OperatorFindUniqueArgs} args - Arguments to find a Operator
     * @example
     * // Get one Operator
     * const operator = await prisma.operator.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OperatorFindUniqueArgs>(args: SelectSubset<T, OperatorFindUniqueArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Operator that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {OperatorFindUniqueOrThrowArgs} args - Arguments to find a Operator
     * @example
     * // Get one Operator
     * const operator = await prisma.operator.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OperatorFindUniqueOrThrowArgs>(args: SelectSubset<T, OperatorFindUniqueOrThrowArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Operator that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OperatorFindFirstArgs} args - Arguments to find a Operator
     * @example
     * // Get one Operator
     * const operator = await prisma.operator.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OperatorFindFirstArgs>(args?: SelectSubset<T, OperatorFindFirstArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Operator that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OperatorFindFirstOrThrowArgs} args - Arguments to find a Operator
     * @example
     * // Get one Operator
     * const operator = await prisma.operator.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OperatorFindFirstOrThrowArgs>(args?: SelectSubset<T, OperatorFindFirstOrThrowArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Operators that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OperatorFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Operators
     * const operators = await prisma.operator.findMany()
     * 
     * // Get first 10 Operators
     * const operators = await prisma.operator.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const operatorWithIdOnly = await prisma.operator.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends OperatorFindManyArgs>(args?: SelectSubset<T, OperatorFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Operator.
     * @param {OperatorCreateArgs} args - Arguments to create a Operator.
     * @example
     * // Create one Operator
     * const Operator = await prisma.operator.create({
     *   data: {
     *     // ... data to create a Operator
     *   }
     * })
     * 
     */
    create<T extends OperatorCreateArgs>(args: SelectSubset<T, OperatorCreateArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Operators.
     * @param {OperatorCreateManyArgs} args - Arguments to create many Operators.
     * @example
     * // Create many Operators
     * const operator = await prisma.operator.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends OperatorCreateManyArgs>(args?: SelectSubset<T, OperatorCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Operators and returns the data saved in the database.
     * @param {OperatorCreateManyAndReturnArgs} args - Arguments to create many Operators.
     * @example
     * // Create many Operators
     * const operator = await prisma.operator.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Operators and only return the `id`
     * const operatorWithIdOnly = await prisma.operator.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends OperatorCreateManyAndReturnArgs>(args?: SelectSubset<T, OperatorCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Operator.
     * @param {OperatorDeleteArgs} args - Arguments to delete one Operator.
     * @example
     * // Delete one Operator
     * const Operator = await prisma.operator.delete({
     *   where: {
     *     // ... filter to delete one Operator
     *   }
     * })
     * 
     */
    delete<T extends OperatorDeleteArgs>(args: SelectSubset<T, OperatorDeleteArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Operator.
     * @param {OperatorUpdateArgs} args - Arguments to update one Operator.
     * @example
     * // Update one Operator
     * const operator = await prisma.operator.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends OperatorUpdateArgs>(args: SelectSubset<T, OperatorUpdateArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Operators.
     * @param {OperatorDeleteManyArgs} args - Arguments to filter Operators to delete.
     * @example
     * // Delete a few Operators
     * const { count } = await prisma.operator.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends OperatorDeleteManyArgs>(args?: SelectSubset<T, OperatorDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Operators.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OperatorUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Operators
     * const operator = await prisma.operator.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends OperatorUpdateManyArgs>(args: SelectSubset<T, OperatorUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Operator.
     * @param {OperatorUpsertArgs} args - Arguments to update or create a Operator.
     * @example
     * // Update or create a Operator
     * const operator = await prisma.operator.upsert({
     *   create: {
     *     // ... data to create a Operator
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Operator we want to update
     *   }
     * })
     */
    upsert<T extends OperatorUpsertArgs>(args: SelectSubset<T, OperatorUpsertArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Operators.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OperatorCountArgs} args - Arguments to filter Operators to count.
     * @example
     * // Count the number of Operators
     * const count = await prisma.operator.count({
     *   where: {
     *     // ... the filter for the Operators we want to count
     *   }
     * })
    **/
    count<T extends OperatorCountArgs>(
      args?: Subset<T, OperatorCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OperatorCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Operator.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OperatorAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OperatorAggregateArgs>(args: Subset<T, OperatorAggregateArgs>): Prisma.PrismaPromise<GetOperatorAggregateType<T>>

    /**
     * Group by Operator.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OperatorGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OperatorGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OperatorGroupByArgs['orderBy'] }
        : { orderBy?: OperatorGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OperatorGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOperatorGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Operator model
   */
  readonly fields: OperatorFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Operator.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OperatorClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    timeEntries<T extends Operator$timeEntriesArgs<ExtArgs> = {}>(args?: Subset<T, Operator$timeEntriesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Operator model
   */ 
  interface OperatorFieldRefs {
    readonly id: FieldRef<"Operator", 'String'>
    readonly nombreCompleto: FieldRef<"Operator", 'String'>
    readonly activo: FieldRef<"Operator", 'Boolean'>
    readonly etiquetas: FieldRef<"Operator", 'Json'>
    readonly pin: FieldRef<"Operator", 'String'>
    readonly role: FieldRef<"Operator", 'String'>
    readonly createdAt: FieldRef<"Operator", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Operator findUnique
   */
  export type OperatorFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * Filter, which Operator to fetch.
     */
    where: OperatorWhereUniqueInput
  }

  /**
   * Operator findUniqueOrThrow
   */
  export type OperatorFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * Filter, which Operator to fetch.
     */
    where: OperatorWhereUniqueInput
  }

  /**
   * Operator findFirst
   */
  export type OperatorFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * Filter, which Operator to fetch.
     */
    where?: OperatorWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Operators to fetch.
     */
    orderBy?: OperatorOrderByWithRelationInput | OperatorOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Operators.
     */
    cursor?: OperatorWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Operators from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Operators.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Operators.
     */
    distinct?: OperatorScalarFieldEnum | OperatorScalarFieldEnum[]
  }

  /**
   * Operator findFirstOrThrow
   */
  export type OperatorFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * Filter, which Operator to fetch.
     */
    where?: OperatorWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Operators to fetch.
     */
    orderBy?: OperatorOrderByWithRelationInput | OperatorOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Operators.
     */
    cursor?: OperatorWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Operators from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Operators.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Operators.
     */
    distinct?: OperatorScalarFieldEnum | OperatorScalarFieldEnum[]
  }

  /**
   * Operator findMany
   */
  export type OperatorFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * Filter, which Operators to fetch.
     */
    where?: OperatorWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Operators to fetch.
     */
    orderBy?: OperatorOrderByWithRelationInput | OperatorOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Operators.
     */
    cursor?: OperatorWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Operators from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Operators.
     */
    skip?: number
    distinct?: OperatorScalarFieldEnum | OperatorScalarFieldEnum[]
  }

  /**
   * Operator create
   */
  export type OperatorCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * The data needed to create a Operator.
     */
    data: XOR<OperatorCreateInput, OperatorUncheckedCreateInput>
  }

  /**
   * Operator createMany
   */
  export type OperatorCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Operators.
     */
    data: OperatorCreateManyInput | OperatorCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Operator createManyAndReturn
   */
  export type OperatorCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Operators.
     */
    data: OperatorCreateManyInput | OperatorCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Operator update
   */
  export type OperatorUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * The data needed to update a Operator.
     */
    data: XOR<OperatorUpdateInput, OperatorUncheckedUpdateInput>
    /**
     * Choose, which Operator to update.
     */
    where: OperatorWhereUniqueInput
  }

  /**
   * Operator updateMany
   */
  export type OperatorUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Operators.
     */
    data: XOR<OperatorUpdateManyMutationInput, OperatorUncheckedUpdateManyInput>
    /**
     * Filter which Operators to update
     */
    where?: OperatorWhereInput
  }

  /**
   * Operator upsert
   */
  export type OperatorUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * The filter to search for the Operator to update in case it exists.
     */
    where: OperatorWhereUniqueInput
    /**
     * In case the Operator found by the `where` argument doesn't exist, create a new Operator with this data.
     */
    create: XOR<OperatorCreateInput, OperatorUncheckedCreateInput>
    /**
     * In case the Operator was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OperatorUpdateInput, OperatorUncheckedUpdateInput>
  }

  /**
   * Operator delete
   */
  export type OperatorDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
    /**
     * Filter which Operator to delete.
     */
    where: OperatorWhereUniqueInput
  }

  /**
   * Operator deleteMany
   */
  export type OperatorDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Operators to delete
     */
    where?: OperatorWhereInput
  }

  /**
   * Operator.timeEntries
   */
  export type Operator$timeEntriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    where?: TimeEntryWhereInput
    orderBy?: TimeEntryOrderByWithRelationInput | TimeEntryOrderByWithRelationInput[]
    cursor?: TimeEntryWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TimeEntryScalarFieldEnum | TimeEntryScalarFieldEnum[]
  }

  /**
   * Operator without action
   */
  export type OperatorDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Operator
     */
    select?: OperatorSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OperatorInclude<ExtArgs> | null
  }


  /**
   * Model FavoriteBlock
   */

  export type AggregateFavoriteBlock = {
    _count: FavoriteBlockCountAggregateOutputType | null
    _min: FavoriteBlockMinAggregateOutputType | null
    _max: FavoriteBlockMaxAggregateOutputType | null
  }

  export type FavoriteBlockMinAggregateOutputType = {
    id: string | null
    name: string | null
    projectId: string | null
    projectName: string | null
    startTime: string | null
    endTime: string | null
    note: string | null
    isNoteOnly: boolean | null
  }

  export type FavoriteBlockMaxAggregateOutputType = {
    id: string | null
    name: string | null
    projectId: string | null
    projectName: string | null
    startTime: string | null
    endTime: string | null
    note: string | null
    isNoteOnly: boolean | null
  }

  export type FavoriteBlockCountAggregateOutputType = {
    id: number
    name: number
    projectId: number
    projectName: number
    startTime: number
    endTime: number
    note: number
    operatorIds: number
    operatorNames: number
    isNoteOnly: number
    _all: number
  }


  export type FavoriteBlockMinAggregateInputType = {
    id?: true
    name?: true
    projectId?: true
    projectName?: true
    startTime?: true
    endTime?: true
    note?: true
    isNoteOnly?: true
  }

  export type FavoriteBlockMaxAggregateInputType = {
    id?: true
    name?: true
    projectId?: true
    projectName?: true
    startTime?: true
    endTime?: true
    note?: true
    isNoteOnly?: true
  }

  export type FavoriteBlockCountAggregateInputType = {
    id?: true
    name?: true
    projectId?: true
    projectName?: true
    startTime?: true
    endTime?: true
    note?: true
    operatorIds?: true
    operatorNames?: true
    isNoteOnly?: true
    _all?: true
  }

  export type FavoriteBlockAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FavoriteBlock to aggregate.
     */
    where?: FavoriteBlockWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FavoriteBlocks to fetch.
     */
    orderBy?: FavoriteBlockOrderByWithRelationInput | FavoriteBlockOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: FavoriteBlockWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FavoriteBlocks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FavoriteBlocks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned FavoriteBlocks
    **/
    _count?: true | FavoriteBlockCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: FavoriteBlockMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: FavoriteBlockMaxAggregateInputType
  }

  export type GetFavoriteBlockAggregateType<T extends FavoriteBlockAggregateArgs> = {
        [P in keyof T & keyof AggregateFavoriteBlock]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateFavoriteBlock[P]>
      : GetScalarType<T[P], AggregateFavoriteBlock[P]>
  }




  export type FavoriteBlockGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FavoriteBlockWhereInput
    orderBy?: FavoriteBlockOrderByWithAggregationInput | FavoriteBlockOrderByWithAggregationInput[]
    by: FavoriteBlockScalarFieldEnum[] | FavoriteBlockScalarFieldEnum
    having?: FavoriteBlockScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: FavoriteBlockCountAggregateInputType | true
    _min?: FavoriteBlockMinAggregateInputType
    _max?: FavoriteBlockMaxAggregateInputType
  }

  export type FavoriteBlockGroupByOutputType = {
    id: string
    name: string
    projectId: string | null
    projectName: string | null
    startTime: string | null
    endTime: string | null
    note: string | null
    operatorIds: JsonValue | null
    operatorNames: JsonValue | null
    isNoteOnly: boolean
    _count: FavoriteBlockCountAggregateOutputType | null
    _min: FavoriteBlockMinAggregateOutputType | null
    _max: FavoriteBlockMaxAggregateOutputType | null
  }

  type GetFavoriteBlockGroupByPayload<T extends FavoriteBlockGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<FavoriteBlockGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof FavoriteBlockGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], FavoriteBlockGroupByOutputType[P]>
            : GetScalarType<T[P], FavoriteBlockGroupByOutputType[P]>
        }
      >
    >


  export type FavoriteBlockSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    projectId?: boolean
    projectName?: boolean
    startTime?: boolean
    endTime?: boolean
    note?: boolean
    operatorIds?: boolean
    operatorNames?: boolean
    isNoteOnly?: boolean
  }, ExtArgs["result"]["favoriteBlock"]>

  export type FavoriteBlockSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    projectId?: boolean
    projectName?: boolean
    startTime?: boolean
    endTime?: boolean
    note?: boolean
    operatorIds?: boolean
    operatorNames?: boolean
    isNoteOnly?: boolean
  }, ExtArgs["result"]["favoriteBlock"]>

  export type FavoriteBlockSelectScalar = {
    id?: boolean
    name?: boolean
    projectId?: boolean
    projectName?: boolean
    startTime?: boolean
    endTime?: boolean
    note?: boolean
    operatorIds?: boolean
    operatorNames?: boolean
    isNoteOnly?: boolean
  }


  export type $FavoriteBlockPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "FavoriteBlock"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      projectId: string | null
      projectName: string | null
      startTime: string | null
      endTime: string | null
      note: string | null
      operatorIds: Prisma.JsonValue | null
      operatorNames: Prisma.JsonValue | null
      isNoteOnly: boolean
    }, ExtArgs["result"]["favoriteBlock"]>
    composites: {}
  }

  type FavoriteBlockGetPayload<S extends boolean | null | undefined | FavoriteBlockDefaultArgs> = $Result.GetResult<Prisma.$FavoriteBlockPayload, S>

  type FavoriteBlockCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<FavoriteBlockFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: FavoriteBlockCountAggregateInputType | true
    }

  export interface FavoriteBlockDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['FavoriteBlock'], meta: { name: 'FavoriteBlock' } }
    /**
     * Find zero or one FavoriteBlock that matches the filter.
     * @param {FavoriteBlockFindUniqueArgs} args - Arguments to find a FavoriteBlock
     * @example
     * // Get one FavoriteBlock
     * const favoriteBlock = await prisma.favoriteBlock.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FavoriteBlockFindUniqueArgs>(args: SelectSubset<T, FavoriteBlockFindUniqueArgs<ExtArgs>>): Prisma__FavoriteBlockClient<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one FavoriteBlock that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {FavoriteBlockFindUniqueOrThrowArgs} args - Arguments to find a FavoriteBlock
     * @example
     * // Get one FavoriteBlock
     * const favoriteBlock = await prisma.favoriteBlock.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FavoriteBlockFindUniqueOrThrowArgs>(args: SelectSubset<T, FavoriteBlockFindUniqueOrThrowArgs<ExtArgs>>): Prisma__FavoriteBlockClient<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first FavoriteBlock that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FavoriteBlockFindFirstArgs} args - Arguments to find a FavoriteBlock
     * @example
     * // Get one FavoriteBlock
     * const favoriteBlock = await prisma.favoriteBlock.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FavoriteBlockFindFirstArgs>(args?: SelectSubset<T, FavoriteBlockFindFirstArgs<ExtArgs>>): Prisma__FavoriteBlockClient<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first FavoriteBlock that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FavoriteBlockFindFirstOrThrowArgs} args - Arguments to find a FavoriteBlock
     * @example
     * // Get one FavoriteBlock
     * const favoriteBlock = await prisma.favoriteBlock.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FavoriteBlockFindFirstOrThrowArgs>(args?: SelectSubset<T, FavoriteBlockFindFirstOrThrowArgs<ExtArgs>>): Prisma__FavoriteBlockClient<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more FavoriteBlocks that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FavoriteBlockFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all FavoriteBlocks
     * const favoriteBlocks = await prisma.favoriteBlock.findMany()
     * 
     * // Get first 10 FavoriteBlocks
     * const favoriteBlocks = await prisma.favoriteBlock.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const favoriteBlockWithIdOnly = await prisma.favoriteBlock.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends FavoriteBlockFindManyArgs>(args?: SelectSubset<T, FavoriteBlockFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a FavoriteBlock.
     * @param {FavoriteBlockCreateArgs} args - Arguments to create a FavoriteBlock.
     * @example
     * // Create one FavoriteBlock
     * const FavoriteBlock = await prisma.favoriteBlock.create({
     *   data: {
     *     // ... data to create a FavoriteBlock
     *   }
     * })
     * 
     */
    create<T extends FavoriteBlockCreateArgs>(args: SelectSubset<T, FavoriteBlockCreateArgs<ExtArgs>>): Prisma__FavoriteBlockClient<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many FavoriteBlocks.
     * @param {FavoriteBlockCreateManyArgs} args - Arguments to create many FavoriteBlocks.
     * @example
     * // Create many FavoriteBlocks
     * const favoriteBlock = await prisma.favoriteBlock.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends FavoriteBlockCreateManyArgs>(args?: SelectSubset<T, FavoriteBlockCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many FavoriteBlocks and returns the data saved in the database.
     * @param {FavoriteBlockCreateManyAndReturnArgs} args - Arguments to create many FavoriteBlocks.
     * @example
     * // Create many FavoriteBlocks
     * const favoriteBlock = await prisma.favoriteBlock.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many FavoriteBlocks and only return the `id`
     * const favoriteBlockWithIdOnly = await prisma.favoriteBlock.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends FavoriteBlockCreateManyAndReturnArgs>(args?: SelectSubset<T, FavoriteBlockCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a FavoriteBlock.
     * @param {FavoriteBlockDeleteArgs} args - Arguments to delete one FavoriteBlock.
     * @example
     * // Delete one FavoriteBlock
     * const FavoriteBlock = await prisma.favoriteBlock.delete({
     *   where: {
     *     // ... filter to delete one FavoriteBlock
     *   }
     * })
     * 
     */
    delete<T extends FavoriteBlockDeleteArgs>(args: SelectSubset<T, FavoriteBlockDeleteArgs<ExtArgs>>): Prisma__FavoriteBlockClient<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one FavoriteBlock.
     * @param {FavoriteBlockUpdateArgs} args - Arguments to update one FavoriteBlock.
     * @example
     * // Update one FavoriteBlock
     * const favoriteBlock = await prisma.favoriteBlock.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends FavoriteBlockUpdateArgs>(args: SelectSubset<T, FavoriteBlockUpdateArgs<ExtArgs>>): Prisma__FavoriteBlockClient<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more FavoriteBlocks.
     * @param {FavoriteBlockDeleteManyArgs} args - Arguments to filter FavoriteBlocks to delete.
     * @example
     * // Delete a few FavoriteBlocks
     * const { count } = await prisma.favoriteBlock.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends FavoriteBlockDeleteManyArgs>(args?: SelectSubset<T, FavoriteBlockDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more FavoriteBlocks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FavoriteBlockUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many FavoriteBlocks
     * const favoriteBlock = await prisma.favoriteBlock.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends FavoriteBlockUpdateManyArgs>(args: SelectSubset<T, FavoriteBlockUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one FavoriteBlock.
     * @param {FavoriteBlockUpsertArgs} args - Arguments to update or create a FavoriteBlock.
     * @example
     * // Update or create a FavoriteBlock
     * const favoriteBlock = await prisma.favoriteBlock.upsert({
     *   create: {
     *     // ... data to create a FavoriteBlock
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the FavoriteBlock we want to update
     *   }
     * })
     */
    upsert<T extends FavoriteBlockUpsertArgs>(args: SelectSubset<T, FavoriteBlockUpsertArgs<ExtArgs>>): Prisma__FavoriteBlockClient<$Result.GetResult<Prisma.$FavoriteBlockPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of FavoriteBlocks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FavoriteBlockCountArgs} args - Arguments to filter FavoriteBlocks to count.
     * @example
     * // Count the number of FavoriteBlocks
     * const count = await prisma.favoriteBlock.count({
     *   where: {
     *     // ... the filter for the FavoriteBlocks we want to count
     *   }
     * })
    **/
    count<T extends FavoriteBlockCountArgs>(
      args?: Subset<T, FavoriteBlockCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], FavoriteBlockCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a FavoriteBlock.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FavoriteBlockAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends FavoriteBlockAggregateArgs>(args: Subset<T, FavoriteBlockAggregateArgs>): Prisma.PrismaPromise<GetFavoriteBlockAggregateType<T>>

    /**
     * Group by FavoriteBlock.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FavoriteBlockGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends FavoriteBlockGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FavoriteBlockGroupByArgs['orderBy'] }
        : { orderBy?: FavoriteBlockGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, FavoriteBlockGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetFavoriteBlockGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the FavoriteBlock model
   */
  readonly fields: FavoriteBlockFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for FavoriteBlock.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FavoriteBlockClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the FavoriteBlock model
   */ 
  interface FavoriteBlockFieldRefs {
    readonly id: FieldRef<"FavoriteBlock", 'String'>
    readonly name: FieldRef<"FavoriteBlock", 'String'>
    readonly projectId: FieldRef<"FavoriteBlock", 'String'>
    readonly projectName: FieldRef<"FavoriteBlock", 'String'>
    readonly startTime: FieldRef<"FavoriteBlock", 'String'>
    readonly endTime: FieldRef<"FavoriteBlock", 'String'>
    readonly note: FieldRef<"FavoriteBlock", 'String'>
    readonly operatorIds: FieldRef<"FavoriteBlock", 'Json'>
    readonly operatorNames: FieldRef<"FavoriteBlock", 'Json'>
    readonly isNoteOnly: FieldRef<"FavoriteBlock", 'Boolean'>
  }
    

  // Custom InputTypes
  /**
   * FavoriteBlock findUnique
   */
  export type FavoriteBlockFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * Filter, which FavoriteBlock to fetch.
     */
    where: FavoriteBlockWhereUniqueInput
  }

  /**
   * FavoriteBlock findUniqueOrThrow
   */
  export type FavoriteBlockFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * Filter, which FavoriteBlock to fetch.
     */
    where: FavoriteBlockWhereUniqueInput
  }

  /**
   * FavoriteBlock findFirst
   */
  export type FavoriteBlockFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * Filter, which FavoriteBlock to fetch.
     */
    where?: FavoriteBlockWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FavoriteBlocks to fetch.
     */
    orderBy?: FavoriteBlockOrderByWithRelationInput | FavoriteBlockOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FavoriteBlocks.
     */
    cursor?: FavoriteBlockWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FavoriteBlocks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FavoriteBlocks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FavoriteBlocks.
     */
    distinct?: FavoriteBlockScalarFieldEnum | FavoriteBlockScalarFieldEnum[]
  }

  /**
   * FavoriteBlock findFirstOrThrow
   */
  export type FavoriteBlockFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * Filter, which FavoriteBlock to fetch.
     */
    where?: FavoriteBlockWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FavoriteBlocks to fetch.
     */
    orderBy?: FavoriteBlockOrderByWithRelationInput | FavoriteBlockOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FavoriteBlocks.
     */
    cursor?: FavoriteBlockWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FavoriteBlocks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FavoriteBlocks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FavoriteBlocks.
     */
    distinct?: FavoriteBlockScalarFieldEnum | FavoriteBlockScalarFieldEnum[]
  }

  /**
   * FavoriteBlock findMany
   */
  export type FavoriteBlockFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * Filter, which FavoriteBlocks to fetch.
     */
    where?: FavoriteBlockWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FavoriteBlocks to fetch.
     */
    orderBy?: FavoriteBlockOrderByWithRelationInput | FavoriteBlockOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing FavoriteBlocks.
     */
    cursor?: FavoriteBlockWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FavoriteBlocks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FavoriteBlocks.
     */
    skip?: number
    distinct?: FavoriteBlockScalarFieldEnum | FavoriteBlockScalarFieldEnum[]
  }

  /**
   * FavoriteBlock create
   */
  export type FavoriteBlockCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * The data needed to create a FavoriteBlock.
     */
    data: XOR<FavoriteBlockCreateInput, FavoriteBlockUncheckedCreateInput>
  }

  /**
   * FavoriteBlock createMany
   */
  export type FavoriteBlockCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many FavoriteBlocks.
     */
    data: FavoriteBlockCreateManyInput | FavoriteBlockCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * FavoriteBlock createManyAndReturn
   */
  export type FavoriteBlockCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many FavoriteBlocks.
     */
    data: FavoriteBlockCreateManyInput | FavoriteBlockCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * FavoriteBlock update
   */
  export type FavoriteBlockUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * The data needed to update a FavoriteBlock.
     */
    data: XOR<FavoriteBlockUpdateInput, FavoriteBlockUncheckedUpdateInput>
    /**
     * Choose, which FavoriteBlock to update.
     */
    where: FavoriteBlockWhereUniqueInput
  }

  /**
   * FavoriteBlock updateMany
   */
  export type FavoriteBlockUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update FavoriteBlocks.
     */
    data: XOR<FavoriteBlockUpdateManyMutationInput, FavoriteBlockUncheckedUpdateManyInput>
    /**
     * Filter which FavoriteBlocks to update
     */
    where?: FavoriteBlockWhereInput
  }

  /**
   * FavoriteBlock upsert
   */
  export type FavoriteBlockUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * The filter to search for the FavoriteBlock to update in case it exists.
     */
    where: FavoriteBlockWhereUniqueInput
    /**
     * In case the FavoriteBlock found by the `where` argument doesn't exist, create a new FavoriteBlock with this data.
     */
    create: XOR<FavoriteBlockCreateInput, FavoriteBlockUncheckedCreateInput>
    /**
     * In case the FavoriteBlock was found with the provided `where` argument, update it with this data.
     */
    update: XOR<FavoriteBlockUpdateInput, FavoriteBlockUncheckedUpdateInput>
  }

  /**
   * FavoriteBlock delete
   */
  export type FavoriteBlockDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
    /**
     * Filter which FavoriteBlock to delete.
     */
    where: FavoriteBlockWhereUniqueInput
  }

  /**
   * FavoriteBlock deleteMany
   */
  export type FavoriteBlockDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FavoriteBlocks to delete
     */
    where?: FavoriteBlockWhereInput
  }

  /**
   * FavoriteBlock without action
   */
  export type FavoriteBlockDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FavoriteBlock
     */
    select?: FavoriteBlockSelect<ExtArgs> | null
  }


  /**
   * Model Planning
   */

  export type AggregatePlanning = {
    _count: PlanningCountAggregateOutputType | null
    _min: PlanningMinAggregateOutputType | null
    _max: PlanningMaxAggregateOutputType | null
  }

  export type PlanningMinAggregateOutputType = {
    id: string | null
    fecha: string | null
    createdAt: Date | null
  }

  export type PlanningMaxAggregateOutputType = {
    id: string | null
    fecha: string | null
    createdAt: Date | null
  }

  export type PlanningCountAggregateOutputType = {
    id: number
    fecha: number
    blocks: number
    createdAt: number
    _all: number
  }


  export type PlanningMinAggregateInputType = {
    id?: true
    fecha?: true
    createdAt?: true
  }

  export type PlanningMaxAggregateInputType = {
    id?: true
    fecha?: true
    createdAt?: true
  }

  export type PlanningCountAggregateInputType = {
    id?: true
    fecha?: true
    blocks?: true
    createdAt?: true
    _all?: true
  }

  export type PlanningAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Planning to aggregate.
     */
    where?: PlanningWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Plannings to fetch.
     */
    orderBy?: PlanningOrderByWithRelationInput | PlanningOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PlanningWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Plannings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Plannings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Plannings
    **/
    _count?: true | PlanningCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PlanningMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PlanningMaxAggregateInputType
  }

  export type GetPlanningAggregateType<T extends PlanningAggregateArgs> = {
        [P in keyof T & keyof AggregatePlanning]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePlanning[P]>
      : GetScalarType<T[P], AggregatePlanning[P]>
  }




  export type PlanningGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PlanningWhereInput
    orderBy?: PlanningOrderByWithAggregationInput | PlanningOrderByWithAggregationInput[]
    by: PlanningScalarFieldEnum[] | PlanningScalarFieldEnum
    having?: PlanningScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PlanningCountAggregateInputType | true
    _min?: PlanningMinAggregateInputType
    _max?: PlanningMaxAggregateInputType
  }

  export type PlanningGroupByOutputType = {
    id: string
    fecha: string
    blocks: JsonValue
    createdAt: Date
    _count: PlanningCountAggregateOutputType | null
    _min: PlanningMinAggregateOutputType | null
    _max: PlanningMaxAggregateOutputType | null
  }

  type GetPlanningGroupByPayload<T extends PlanningGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PlanningGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PlanningGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PlanningGroupByOutputType[P]>
            : GetScalarType<T[P], PlanningGroupByOutputType[P]>
        }
      >
    >


  export type PlanningSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fecha?: boolean
    blocks?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["planning"]>

  export type PlanningSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    fecha?: boolean
    blocks?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["planning"]>

  export type PlanningSelectScalar = {
    id?: boolean
    fecha?: boolean
    blocks?: boolean
    createdAt?: boolean
  }


  export type $PlanningPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Planning"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      fecha: string
      blocks: Prisma.JsonValue
      createdAt: Date
    }, ExtArgs["result"]["planning"]>
    composites: {}
  }

  type PlanningGetPayload<S extends boolean | null | undefined | PlanningDefaultArgs> = $Result.GetResult<Prisma.$PlanningPayload, S>

  type PlanningCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PlanningFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PlanningCountAggregateInputType | true
    }

  export interface PlanningDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Planning'], meta: { name: 'Planning' } }
    /**
     * Find zero or one Planning that matches the filter.
     * @param {PlanningFindUniqueArgs} args - Arguments to find a Planning
     * @example
     * // Get one Planning
     * const planning = await prisma.planning.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PlanningFindUniqueArgs>(args: SelectSubset<T, PlanningFindUniqueArgs<ExtArgs>>): Prisma__PlanningClient<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Planning that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PlanningFindUniqueOrThrowArgs} args - Arguments to find a Planning
     * @example
     * // Get one Planning
     * const planning = await prisma.planning.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PlanningFindUniqueOrThrowArgs>(args: SelectSubset<T, PlanningFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PlanningClient<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Planning that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanningFindFirstArgs} args - Arguments to find a Planning
     * @example
     * // Get one Planning
     * const planning = await prisma.planning.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PlanningFindFirstArgs>(args?: SelectSubset<T, PlanningFindFirstArgs<ExtArgs>>): Prisma__PlanningClient<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Planning that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanningFindFirstOrThrowArgs} args - Arguments to find a Planning
     * @example
     * // Get one Planning
     * const planning = await prisma.planning.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PlanningFindFirstOrThrowArgs>(args?: SelectSubset<T, PlanningFindFirstOrThrowArgs<ExtArgs>>): Prisma__PlanningClient<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Plannings that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanningFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Plannings
     * const plannings = await prisma.planning.findMany()
     * 
     * // Get first 10 Plannings
     * const plannings = await prisma.planning.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const planningWithIdOnly = await prisma.planning.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PlanningFindManyArgs>(args?: SelectSubset<T, PlanningFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Planning.
     * @param {PlanningCreateArgs} args - Arguments to create a Planning.
     * @example
     * // Create one Planning
     * const Planning = await prisma.planning.create({
     *   data: {
     *     // ... data to create a Planning
     *   }
     * })
     * 
     */
    create<T extends PlanningCreateArgs>(args: SelectSubset<T, PlanningCreateArgs<ExtArgs>>): Prisma__PlanningClient<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Plannings.
     * @param {PlanningCreateManyArgs} args - Arguments to create many Plannings.
     * @example
     * // Create many Plannings
     * const planning = await prisma.planning.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PlanningCreateManyArgs>(args?: SelectSubset<T, PlanningCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Plannings and returns the data saved in the database.
     * @param {PlanningCreateManyAndReturnArgs} args - Arguments to create many Plannings.
     * @example
     * // Create many Plannings
     * const planning = await prisma.planning.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Plannings and only return the `id`
     * const planningWithIdOnly = await prisma.planning.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PlanningCreateManyAndReturnArgs>(args?: SelectSubset<T, PlanningCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Planning.
     * @param {PlanningDeleteArgs} args - Arguments to delete one Planning.
     * @example
     * // Delete one Planning
     * const Planning = await prisma.planning.delete({
     *   where: {
     *     // ... filter to delete one Planning
     *   }
     * })
     * 
     */
    delete<T extends PlanningDeleteArgs>(args: SelectSubset<T, PlanningDeleteArgs<ExtArgs>>): Prisma__PlanningClient<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Planning.
     * @param {PlanningUpdateArgs} args - Arguments to update one Planning.
     * @example
     * // Update one Planning
     * const planning = await prisma.planning.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PlanningUpdateArgs>(args: SelectSubset<T, PlanningUpdateArgs<ExtArgs>>): Prisma__PlanningClient<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Plannings.
     * @param {PlanningDeleteManyArgs} args - Arguments to filter Plannings to delete.
     * @example
     * // Delete a few Plannings
     * const { count } = await prisma.planning.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PlanningDeleteManyArgs>(args?: SelectSubset<T, PlanningDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Plannings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanningUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Plannings
     * const planning = await prisma.planning.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PlanningUpdateManyArgs>(args: SelectSubset<T, PlanningUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Planning.
     * @param {PlanningUpsertArgs} args - Arguments to update or create a Planning.
     * @example
     * // Update or create a Planning
     * const planning = await prisma.planning.upsert({
     *   create: {
     *     // ... data to create a Planning
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Planning we want to update
     *   }
     * })
     */
    upsert<T extends PlanningUpsertArgs>(args: SelectSubset<T, PlanningUpsertArgs<ExtArgs>>): Prisma__PlanningClient<$Result.GetResult<Prisma.$PlanningPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Plannings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanningCountArgs} args - Arguments to filter Plannings to count.
     * @example
     * // Count the number of Plannings
     * const count = await prisma.planning.count({
     *   where: {
     *     // ... the filter for the Plannings we want to count
     *   }
     * })
    **/
    count<T extends PlanningCountArgs>(
      args?: Subset<T, PlanningCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PlanningCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Planning.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanningAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PlanningAggregateArgs>(args: Subset<T, PlanningAggregateArgs>): Prisma.PrismaPromise<GetPlanningAggregateType<T>>

    /**
     * Group by Planning.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanningGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PlanningGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PlanningGroupByArgs['orderBy'] }
        : { orderBy?: PlanningGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PlanningGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPlanningGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Planning model
   */
  readonly fields: PlanningFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Planning.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PlanningClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Planning model
   */ 
  interface PlanningFieldRefs {
    readonly id: FieldRef<"Planning", 'String'>
    readonly fecha: FieldRef<"Planning", 'String'>
    readonly blocks: FieldRef<"Planning", 'Json'>
    readonly createdAt: FieldRef<"Planning", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Planning findUnique
   */
  export type PlanningFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * Filter, which Planning to fetch.
     */
    where: PlanningWhereUniqueInput
  }

  /**
   * Planning findUniqueOrThrow
   */
  export type PlanningFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * Filter, which Planning to fetch.
     */
    where: PlanningWhereUniqueInput
  }

  /**
   * Planning findFirst
   */
  export type PlanningFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * Filter, which Planning to fetch.
     */
    where?: PlanningWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Plannings to fetch.
     */
    orderBy?: PlanningOrderByWithRelationInput | PlanningOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Plannings.
     */
    cursor?: PlanningWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Plannings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Plannings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Plannings.
     */
    distinct?: PlanningScalarFieldEnum | PlanningScalarFieldEnum[]
  }

  /**
   * Planning findFirstOrThrow
   */
  export type PlanningFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * Filter, which Planning to fetch.
     */
    where?: PlanningWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Plannings to fetch.
     */
    orderBy?: PlanningOrderByWithRelationInput | PlanningOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Plannings.
     */
    cursor?: PlanningWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Plannings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Plannings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Plannings.
     */
    distinct?: PlanningScalarFieldEnum | PlanningScalarFieldEnum[]
  }

  /**
   * Planning findMany
   */
  export type PlanningFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * Filter, which Plannings to fetch.
     */
    where?: PlanningWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Plannings to fetch.
     */
    orderBy?: PlanningOrderByWithRelationInput | PlanningOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Plannings.
     */
    cursor?: PlanningWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Plannings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Plannings.
     */
    skip?: number
    distinct?: PlanningScalarFieldEnum | PlanningScalarFieldEnum[]
  }

  /**
   * Planning create
   */
  export type PlanningCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * The data needed to create a Planning.
     */
    data: XOR<PlanningCreateInput, PlanningUncheckedCreateInput>
  }

  /**
   * Planning createMany
   */
  export type PlanningCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Plannings.
     */
    data: PlanningCreateManyInput | PlanningCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Planning createManyAndReturn
   */
  export type PlanningCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Plannings.
     */
    data: PlanningCreateManyInput | PlanningCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Planning update
   */
  export type PlanningUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * The data needed to update a Planning.
     */
    data: XOR<PlanningUpdateInput, PlanningUncheckedUpdateInput>
    /**
     * Choose, which Planning to update.
     */
    where: PlanningWhereUniqueInput
  }

  /**
   * Planning updateMany
   */
  export type PlanningUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Plannings.
     */
    data: XOR<PlanningUpdateManyMutationInput, PlanningUncheckedUpdateManyInput>
    /**
     * Filter which Plannings to update
     */
    where?: PlanningWhereInput
  }

  /**
   * Planning upsert
   */
  export type PlanningUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * The filter to search for the Planning to update in case it exists.
     */
    where: PlanningWhereUniqueInput
    /**
     * In case the Planning found by the `where` argument doesn't exist, create a new Planning with this data.
     */
    create: XOR<PlanningCreateInput, PlanningUncheckedCreateInput>
    /**
     * In case the Planning was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PlanningUpdateInput, PlanningUncheckedUpdateInput>
  }

  /**
   * Planning delete
   */
  export type PlanningDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
    /**
     * Filter which Planning to delete.
     */
    where: PlanningWhereUniqueInput
  }

  /**
   * Planning deleteMany
   */
  export type PlanningDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Plannings to delete
     */
    where?: PlanningWhereInput
  }

  /**
   * Planning without action
   */
  export type PlanningDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Planning
     */
    select?: PlanningSelect<ExtArgs> | null
  }


  /**
   * Model HdbClient
   */

  export type AggregateHdbClient = {
    _count: HdbClientCountAggregateOutputType | null
    _min: HdbClientMinAggregateOutputType | null
    _max: HdbClientMaxAggregateOutputType | null
  }

  export type HdbClientMinAggregateOutputType = {
    id: string | null
    nombre: string | null
    email: string | null
    telefono: string | null
    direccion: string | null
    activo: boolean | null
    createdAt: Date | null
  }

  export type HdbClientMaxAggregateOutputType = {
    id: string | null
    nombre: string | null
    email: string | null
    telefono: string | null
    direccion: string | null
    activo: boolean | null
    createdAt: Date | null
  }

  export type HdbClientCountAggregateOutputType = {
    id: number
    nombre: number
    email: number
    telefono: number
    direccion: number
    activo: number
    createdAt: number
    _all: number
  }


  export type HdbClientMinAggregateInputType = {
    id?: true
    nombre?: true
    email?: true
    telefono?: true
    direccion?: true
    activo?: true
    createdAt?: true
  }

  export type HdbClientMaxAggregateInputType = {
    id?: true
    nombre?: true
    email?: true
    telefono?: true
    direccion?: true
    activo?: true
    createdAt?: true
  }

  export type HdbClientCountAggregateInputType = {
    id?: true
    nombre?: true
    email?: true
    telefono?: true
    direccion?: true
    activo?: true
    createdAt?: true
    _all?: true
  }

  export type HdbClientAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which HdbClient to aggregate.
     */
    where?: HdbClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HdbClients to fetch.
     */
    orderBy?: HdbClientOrderByWithRelationInput | HdbClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: HdbClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HdbClients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HdbClients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned HdbClients
    **/
    _count?: true | HdbClientCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: HdbClientMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: HdbClientMaxAggregateInputType
  }

  export type GetHdbClientAggregateType<T extends HdbClientAggregateArgs> = {
        [P in keyof T & keyof AggregateHdbClient]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateHdbClient[P]>
      : GetScalarType<T[P], AggregateHdbClient[P]>
  }




  export type HdbClientGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: HdbClientWhereInput
    orderBy?: HdbClientOrderByWithAggregationInput | HdbClientOrderByWithAggregationInput[]
    by: HdbClientScalarFieldEnum[] | HdbClientScalarFieldEnum
    having?: HdbClientScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: HdbClientCountAggregateInputType | true
    _min?: HdbClientMinAggregateInputType
    _max?: HdbClientMaxAggregateInputType
  }

  export type HdbClientGroupByOutputType = {
    id: string
    nombre: string
    email: string | null
    telefono: string | null
    direccion: string | null
    activo: boolean
    createdAt: Date
    _count: HdbClientCountAggregateOutputType | null
    _min: HdbClientMinAggregateOutputType | null
    _max: HdbClientMaxAggregateOutputType | null
  }

  type GetHdbClientGroupByPayload<T extends HdbClientGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<HdbClientGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof HdbClientGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], HdbClientGroupByOutputType[P]>
            : GetScalarType<T[P], HdbClientGroupByOutputType[P]>
        }
      >
    >


  export type HdbClientSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nombre?: boolean
    email?: boolean
    telefono?: boolean
    direccion?: boolean
    activo?: boolean
    createdAt?: boolean
    projects?: boolean | HdbClient$projectsArgs<ExtArgs>
    _count?: boolean | HdbClientCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["hdbClient"]>

  export type HdbClientSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nombre?: boolean
    email?: boolean
    telefono?: boolean
    direccion?: boolean
    activo?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["hdbClient"]>

  export type HdbClientSelectScalar = {
    id?: boolean
    nombre?: boolean
    email?: boolean
    telefono?: boolean
    direccion?: boolean
    activo?: boolean
    createdAt?: boolean
  }

  export type HdbClientInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    projects?: boolean | HdbClient$projectsArgs<ExtArgs>
    _count?: boolean | HdbClientCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type HdbClientIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $HdbClientPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "HdbClient"
    objects: {
      projects: Prisma.$ProjectPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      nombre: string
      email: string | null
      telefono: string | null
      direccion: string | null
      activo: boolean
      createdAt: Date
    }, ExtArgs["result"]["hdbClient"]>
    composites: {}
  }

  type HdbClientGetPayload<S extends boolean | null | undefined | HdbClientDefaultArgs> = $Result.GetResult<Prisma.$HdbClientPayload, S>

  type HdbClientCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<HdbClientFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: HdbClientCountAggregateInputType | true
    }

  export interface HdbClientDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['HdbClient'], meta: { name: 'HdbClient' } }
    /**
     * Find zero or one HdbClient that matches the filter.
     * @param {HdbClientFindUniqueArgs} args - Arguments to find a HdbClient
     * @example
     * // Get one HdbClient
     * const hdbClient = await prisma.hdbClient.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends HdbClientFindUniqueArgs>(args: SelectSubset<T, HdbClientFindUniqueArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one HdbClient that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {HdbClientFindUniqueOrThrowArgs} args - Arguments to find a HdbClient
     * @example
     * // Get one HdbClient
     * const hdbClient = await prisma.hdbClient.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends HdbClientFindUniqueOrThrowArgs>(args: SelectSubset<T, HdbClientFindUniqueOrThrowArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first HdbClient that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HdbClientFindFirstArgs} args - Arguments to find a HdbClient
     * @example
     * // Get one HdbClient
     * const hdbClient = await prisma.hdbClient.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends HdbClientFindFirstArgs>(args?: SelectSubset<T, HdbClientFindFirstArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first HdbClient that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HdbClientFindFirstOrThrowArgs} args - Arguments to find a HdbClient
     * @example
     * // Get one HdbClient
     * const hdbClient = await prisma.hdbClient.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends HdbClientFindFirstOrThrowArgs>(args?: SelectSubset<T, HdbClientFindFirstOrThrowArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more HdbClients that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HdbClientFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all HdbClients
     * const hdbClients = await prisma.hdbClient.findMany()
     * 
     * // Get first 10 HdbClients
     * const hdbClients = await prisma.hdbClient.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const hdbClientWithIdOnly = await prisma.hdbClient.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends HdbClientFindManyArgs>(args?: SelectSubset<T, HdbClientFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a HdbClient.
     * @param {HdbClientCreateArgs} args - Arguments to create a HdbClient.
     * @example
     * // Create one HdbClient
     * const HdbClient = await prisma.hdbClient.create({
     *   data: {
     *     // ... data to create a HdbClient
     *   }
     * })
     * 
     */
    create<T extends HdbClientCreateArgs>(args: SelectSubset<T, HdbClientCreateArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many HdbClients.
     * @param {HdbClientCreateManyArgs} args - Arguments to create many HdbClients.
     * @example
     * // Create many HdbClients
     * const hdbClient = await prisma.hdbClient.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends HdbClientCreateManyArgs>(args?: SelectSubset<T, HdbClientCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many HdbClients and returns the data saved in the database.
     * @param {HdbClientCreateManyAndReturnArgs} args - Arguments to create many HdbClients.
     * @example
     * // Create many HdbClients
     * const hdbClient = await prisma.hdbClient.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many HdbClients and only return the `id`
     * const hdbClientWithIdOnly = await prisma.hdbClient.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends HdbClientCreateManyAndReturnArgs>(args?: SelectSubset<T, HdbClientCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a HdbClient.
     * @param {HdbClientDeleteArgs} args - Arguments to delete one HdbClient.
     * @example
     * // Delete one HdbClient
     * const HdbClient = await prisma.hdbClient.delete({
     *   where: {
     *     // ... filter to delete one HdbClient
     *   }
     * })
     * 
     */
    delete<T extends HdbClientDeleteArgs>(args: SelectSubset<T, HdbClientDeleteArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one HdbClient.
     * @param {HdbClientUpdateArgs} args - Arguments to update one HdbClient.
     * @example
     * // Update one HdbClient
     * const hdbClient = await prisma.hdbClient.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends HdbClientUpdateArgs>(args: SelectSubset<T, HdbClientUpdateArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more HdbClients.
     * @param {HdbClientDeleteManyArgs} args - Arguments to filter HdbClients to delete.
     * @example
     * // Delete a few HdbClients
     * const { count } = await prisma.hdbClient.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends HdbClientDeleteManyArgs>(args?: SelectSubset<T, HdbClientDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more HdbClients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HdbClientUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many HdbClients
     * const hdbClient = await prisma.hdbClient.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends HdbClientUpdateManyArgs>(args: SelectSubset<T, HdbClientUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one HdbClient.
     * @param {HdbClientUpsertArgs} args - Arguments to update or create a HdbClient.
     * @example
     * // Update or create a HdbClient
     * const hdbClient = await prisma.hdbClient.upsert({
     *   create: {
     *     // ... data to create a HdbClient
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the HdbClient we want to update
     *   }
     * })
     */
    upsert<T extends HdbClientUpsertArgs>(args: SelectSubset<T, HdbClientUpsertArgs<ExtArgs>>): Prisma__HdbClientClient<$Result.GetResult<Prisma.$HdbClientPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of HdbClients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HdbClientCountArgs} args - Arguments to filter HdbClients to count.
     * @example
     * // Count the number of HdbClients
     * const count = await prisma.hdbClient.count({
     *   where: {
     *     // ... the filter for the HdbClients we want to count
     *   }
     * })
    **/
    count<T extends HdbClientCountArgs>(
      args?: Subset<T, HdbClientCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], HdbClientCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a HdbClient.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HdbClientAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends HdbClientAggregateArgs>(args: Subset<T, HdbClientAggregateArgs>): Prisma.PrismaPromise<GetHdbClientAggregateType<T>>

    /**
     * Group by HdbClient.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HdbClientGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends HdbClientGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: HdbClientGroupByArgs['orderBy'] }
        : { orderBy?: HdbClientGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, HdbClientGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetHdbClientGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the HdbClient model
   */
  readonly fields: HdbClientFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for HdbClient.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__HdbClientClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    projects<T extends HdbClient$projectsArgs<ExtArgs> = {}>(args?: Subset<T, HdbClient$projectsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the HdbClient model
   */ 
  interface HdbClientFieldRefs {
    readonly id: FieldRef<"HdbClient", 'String'>
    readonly nombre: FieldRef<"HdbClient", 'String'>
    readonly email: FieldRef<"HdbClient", 'String'>
    readonly telefono: FieldRef<"HdbClient", 'String'>
    readonly direccion: FieldRef<"HdbClient", 'String'>
    readonly activo: FieldRef<"HdbClient", 'Boolean'>
    readonly createdAt: FieldRef<"HdbClient", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * HdbClient findUnique
   */
  export type HdbClientFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * Filter, which HdbClient to fetch.
     */
    where: HdbClientWhereUniqueInput
  }

  /**
   * HdbClient findUniqueOrThrow
   */
  export type HdbClientFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * Filter, which HdbClient to fetch.
     */
    where: HdbClientWhereUniqueInput
  }

  /**
   * HdbClient findFirst
   */
  export type HdbClientFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * Filter, which HdbClient to fetch.
     */
    where?: HdbClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HdbClients to fetch.
     */
    orderBy?: HdbClientOrderByWithRelationInput | HdbClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for HdbClients.
     */
    cursor?: HdbClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HdbClients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HdbClients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of HdbClients.
     */
    distinct?: HdbClientScalarFieldEnum | HdbClientScalarFieldEnum[]
  }

  /**
   * HdbClient findFirstOrThrow
   */
  export type HdbClientFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * Filter, which HdbClient to fetch.
     */
    where?: HdbClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HdbClients to fetch.
     */
    orderBy?: HdbClientOrderByWithRelationInput | HdbClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for HdbClients.
     */
    cursor?: HdbClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HdbClients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HdbClients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of HdbClients.
     */
    distinct?: HdbClientScalarFieldEnum | HdbClientScalarFieldEnum[]
  }

  /**
   * HdbClient findMany
   */
  export type HdbClientFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * Filter, which HdbClients to fetch.
     */
    where?: HdbClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HdbClients to fetch.
     */
    orderBy?: HdbClientOrderByWithRelationInput | HdbClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing HdbClients.
     */
    cursor?: HdbClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HdbClients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HdbClients.
     */
    skip?: number
    distinct?: HdbClientScalarFieldEnum | HdbClientScalarFieldEnum[]
  }

  /**
   * HdbClient create
   */
  export type HdbClientCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * The data needed to create a HdbClient.
     */
    data: XOR<HdbClientCreateInput, HdbClientUncheckedCreateInput>
  }

  /**
   * HdbClient createMany
   */
  export type HdbClientCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many HdbClients.
     */
    data: HdbClientCreateManyInput | HdbClientCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * HdbClient createManyAndReturn
   */
  export type HdbClientCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many HdbClients.
     */
    data: HdbClientCreateManyInput | HdbClientCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * HdbClient update
   */
  export type HdbClientUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * The data needed to update a HdbClient.
     */
    data: XOR<HdbClientUpdateInput, HdbClientUncheckedUpdateInput>
    /**
     * Choose, which HdbClient to update.
     */
    where: HdbClientWhereUniqueInput
  }

  /**
   * HdbClient updateMany
   */
  export type HdbClientUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update HdbClients.
     */
    data: XOR<HdbClientUpdateManyMutationInput, HdbClientUncheckedUpdateManyInput>
    /**
     * Filter which HdbClients to update
     */
    where?: HdbClientWhereInput
  }

  /**
   * HdbClient upsert
   */
  export type HdbClientUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * The filter to search for the HdbClient to update in case it exists.
     */
    where: HdbClientWhereUniqueInput
    /**
     * In case the HdbClient found by the `where` argument doesn't exist, create a new HdbClient with this data.
     */
    create: XOR<HdbClientCreateInput, HdbClientUncheckedCreateInput>
    /**
     * In case the HdbClient was found with the provided `where` argument, update it with this data.
     */
    update: XOR<HdbClientUpdateInput, HdbClientUncheckedUpdateInput>
  }

  /**
   * HdbClient delete
   */
  export type HdbClientDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
    /**
     * Filter which HdbClient to delete.
     */
    where: HdbClientWhereUniqueInput
  }

  /**
   * HdbClient deleteMany
   */
  export type HdbClientDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which HdbClients to delete
     */
    where?: HdbClientWhereInput
  }

  /**
   * HdbClient.projects
   */
  export type HdbClient$projectsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Project
     */
    select?: ProjectSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProjectInclude<ExtArgs> | null
    where?: ProjectWhereInput
    orderBy?: ProjectOrderByWithRelationInput | ProjectOrderByWithRelationInput[]
    cursor?: ProjectWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ProjectScalarFieldEnum | ProjectScalarFieldEnum[]
  }

  /**
   * HdbClient without action
   */
  export type HdbClientDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HdbClient
     */
    select?: HdbClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HdbClientInclude<ExtArgs> | null
  }


  /**
   * Model TimeEntry
   */

  export type AggregateTimeEntry = {
    _count: TimeEntryCountAggregateOutputType | null
    _avg: TimeEntryAvgAggregateOutputType | null
    _sum: TimeEntrySumAggregateOutputType | null
    _min: TimeEntryMinAggregateOutputType | null
    _max: TimeEntryMaxAggregateOutputType | null
  }

  export type TimeEntryAvgAggregateOutputType = {
    horasTrabajadas: number | null
  }

  export type TimeEntrySumAggregateOutputType = {
    horasTrabajadas: number | null
  }

  export type TimeEntryMinAggregateOutputType = {
    id: string | null
    operatorId: string | null
    projectId: string | null
    fecha: string | null
    horaIngreso: string | null
    horaEgreso: string | null
    horasTrabajadas: number | null
    estadoConfirmado: boolean | null
    confirmadoPorSupervisor: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TimeEntryMaxAggregateOutputType = {
    id: string | null
    operatorId: string | null
    projectId: string | null
    fecha: string | null
    horaIngreso: string | null
    horaEgreso: string | null
    horasTrabajadas: number | null
    estadoConfirmado: boolean | null
    confirmadoPorSupervisor: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TimeEntryCountAggregateOutputType = {
    id: number
    operatorId: number
    projectId: number
    fecha: number
    horaIngreso: number
    horaEgreso: number
    horasTrabajadas: number
    estadoConfirmado: number
    confirmadoPorSupervisor: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TimeEntryAvgAggregateInputType = {
    horasTrabajadas?: true
  }

  export type TimeEntrySumAggregateInputType = {
    horasTrabajadas?: true
  }

  export type TimeEntryMinAggregateInputType = {
    id?: true
    operatorId?: true
    projectId?: true
    fecha?: true
    horaIngreso?: true
    horaEgreso?: true
    horasTrabajadas?: true
    estadoConfirmado?: true
    confirmadoPorSupervisor?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TimeEntryMaxAggregateInputType = {
    id?: true
    operatorId?: true
    projectId?: true
    fecha?: true
    horaIngreso?: true
    horaEgreso?: true
    horasTrabajadas?: true
    estadoConfirmado?: true
    confirmadoPorSupervisor?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TimeEntryCountAggregateInputType = {
    id?: true
    operatorId?: true
    projectId?: true
    fecha?: true
    horaIngreso?: true
    horaEgreso?: true
    horasTrabajadas?: true
    estadoConfirmado?: true
    confirmadoPorSupervisor?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TimeEntryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TimeEntry to aggregate.
     */
    where?: TimeEntryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TimeEntries to fetch.
     */
    orderBy?: TimeEntryOrderByWithRelationInput | TimeEntryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TimeEntryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TimeEntries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TimeEntries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TimeEntries
    **/
    _count?: true | TimeEntryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TimeEntryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TimeEntrySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TimeEntryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TimeEntryMaxAggregateInputType
  }

  export type GetTimeEntryAggregateType<T extends TimeEntryAggregateArgs> = {
        [P in keyof T & keyof AggregateTimeEntry]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTimeEntry[P]>
      : GetScalarType<T[P], AggregateTimeEntry[P]>
  }




  export type TimeEntryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TimeEntryWhereInput
    orderBy?: TimeEntryOrderByWithAggregationInput | TimeEntryOrderByWithAggregationInput[]
    by: TimeEntryScalarFieldEnum[] | TimeEntryScalarFieldEnum
    having?: TimeEntryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TimeEntryCountAggregateInputType | true
    _avg?: TimeEntryAvgAggregateInputType
    _sum?: TimeEntrySumAggregateInputType
    _min?: TimeEntryMinAggregateInputType
    _max?: TimeEntryMaxAggregateInputType
  }

  export type TimeEntryGroupByOutputType = {
    id: string
    operatorId: string
    projectId: string
    fecha: string
    horaIngreso: string | null
    horaEgreso: string | null
    horasTrabajadas: number
    estadoConfirmado: boolean
    confirmadoPorSupervisor: string | null
    createdAt: Date
    updatedAt: Date
    _count: TimeEntryCountAggregateOutputType | null
    _avg: TimeEntryAvgAggregateOutputType | null
    _sum: TimeEntrySumAggregateOutputType | null
    _min: TimeEntryMinAggregateOutputType | null
    _max: TimeEntryMaxAggregateOutputType | null
  }

  type GetTimeEntryGroupByPayload<T extends TimeEntryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TimeEntryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TimeEntryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TimeEntryGroupByOutputType[P]>
            : GetScalarType<T[P], TimeEntryGroupByOutputType[P]>
        }
      >
    >


  export type TimeEntrySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    operatorId?: boolean
    projectId?: boolean
    fecha?: boolean
    horaIngreso?: boolean
    horaEgreso?: boolean
    horasTrabajadas?: boolean
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    operator?: boolean | OperatorDefaultArgs<ExtArgs>
    project?: boolean | ProjectDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["timeEntry"]>

  export type TimeEntrySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    operatorId?: boolean
    projectId?: boolean
    fecha?: boolean
    horaIngreso?: boolean
    horaEgreso?: boolean
    horasTrabajadas?: boolean
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    operator?: boolean | OperatorDefaultArgs<ExtArgs>
    project?: boolean | ProjectDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["timeEntry"]>

  export type TimeEntrySelectScalar = {
    id?: boolean
    operatorId?: boolean
    projectId?: boolean
    fecha?: boolean
    horaIngreso?: boolean
    horaEgreso?: boolean
    horasTrabajadas?: boolean
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TimeEntryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    operator?: boolean | OperatorDefaultArgs<ExtArgs>
    project?: boolean | ProjectDefaultArgs<ExtArgs>
  }
  export type TimeEntryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    operator?: boolean | OperatorDefaultArgs<ExtArgs>
    project?: boolean | ProjectDefaultArgs<ExtArgs>
  }

  export type $TimeEntryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TimeEntry"
    objects: {
      operator: Prisma.$OperatorPayload<ExtArgs>
      project: Prisma.$ProjectPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      operatorId: string
      projectId: string
      fecha: string
      horaIngreso: string | null
      horaEgreso: string | null
      horasTrabajadas: number
      estadoConfirmado: boolean
      confirmadoPorSupervisor: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["timeEntry"]>
    composites: {}
  }

  type TimeEntryGetPayload<S extends boolean | null | undefined | TimeEntryDefaultArgs> = $Result.GetResult<Prisma.$TimeEntryPayload, S>

  type TimeEntryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<TimeEntryFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: TimeEntryCountAggregateInputType | true
    }

  export interface TimeEntryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TimeEntry'], meta: { name: 'TimeEntry' } }
    /**
     * Find zero or one TimeEntry that matches the filter.
     * @param {TimeEntryFindUniqueArgs} args - Arguments to find a TimeEntry
     * @example
     * // Get one TimeEntry
     * const timeEntry = await prisma.timeEntry.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TimeEntryFindUniqueArgs>(args: SelectSubset<T, TimeEntryFindUniqueArgs<ExtArgs>>): Prisma__TimeEntryClient<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one TimeEntry that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {TimeEntryFindUniqueOrThrowArgs} args - Arguments to find a TimeEntry
     * @example
     * // Get one TimeEntry
     * const timeEntry = await prisma.timeEntry.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TimeEntryFindUniqueOrThrowArgs>(args: SelectSubset<T, TimeEntryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TimeEntryClient<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first TimeEntry that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TimeEntryFindFirstArgs} args - Arguments to find a TimeEntry
     * @example
     * // Get one TimeEntry
     * const timeEntry = await prisma.timeEntry.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TimeEntryFindFirstArgs>(args?: SelectSubset<T, TimeEntryFindFirstArgs<ExtArgs>>): Prisma__TimeEntryClient<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first TimeEntry that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TimeEntryFindFirstOrThrowArgs} args - Arguments to find a TimeEntry
     * @example
     * // Get one TimeEntry
     * const timeEntry = await prisma.timeEntry.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TimeEntryFindFirstOrThrowArgs>(args?: SelectSubset<T, TimeEntryFindFirstOrThrowArgs<ExtArgs>>): Prisma__TimeEntryClient<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more TimeEntries that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TimeEntryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TimeEntries
     * const timeEntries = await prisma.timeEntry.findMany()
     * 
     * // Get first 10 TimeEntries
     * const timeEntries = await prisma.timeEntry.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const timeEntryWithIdOnly = await prisma.timeEntry.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TimeEntryFindManyArgs>(args?: SelectSubset<T, TimeEntryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a TimeEntry.
     * @param {TimeEntryCreateArgs} args - Arguments to create a TimeEntry.
     * @example
     * // Create one TimeEntry
     * const TimeEntry = await prisma.timeEntry.create({
     *   data: {
     *     // ... data to create a TimeEntry
     *   }
     * })
     * 
     */
    create<T extends TimeEntryCreateArgs>(args: SelectSubset<T, TimeEntryCreateArgs<ExtArgs>>): Prisma__TimeEntryClient<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many TimeEntries.
     * @param {TimeEntryCreateManyArgs} args - Arguments to create many TimeEntries.
     * @example
     * // Create many TimeEntries
     * const timeEntry = await prisma.timeEntry.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TimeEntryCreateManyArgs>(args?: SelectSubset<T, TimeEntryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TimeEntries and returns the data saved in the database.
     * @param {TimeEntryCreateManyAndReturnArgs} args - Arguments to create many TimeEntries.
     * @example
     * // Create many TimeEntries
     * const timeEntry = await prisma.timeEntry.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TimeEntries and only return the `id`
     * const timeEntryWithIdOnly = await prisma.timeEntry.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TimeEntryCreateManyAndReturnArgs>(args?: SelectSubset<T, TimeEntryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a TimeEntry.
     * @param {TimeEntryDeleteArgs} args - Arguments to delete one TimeEntry.
     * @example
     * // Delete one TimeEntry
     * const TimeEntry = await prisma.timeEntry.delete({
     *   where: {
     *     // ... filter to delete one TimeEntry
     *   }
     * })
     * 
     */
    delete<T extends TimeEntryDeleteArgs>(args: SelectSubset<T, TimeEntryDeleteArgs<ExtArgs>>): Prisma__TimeEntryClient<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one TimeEntry.
     * @param {TimeEntryUpdateArgs} args - Arguments to update one TimeEntry.
     * @example
     * // Update one TimeEntry
     * const timeEntry = await prisma.timeEntry.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TimeEntryUpdateArgs>(args: SelectSubset<T, TimeEntryUpdateArgs<ExtArgs>>): Prisma__TimeEntryClient<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more TimeEntries.
     * @param {TimeEntryDeleteManyArgs} args - Arguments to filter TimeEntries to delete.
     * @example
     * // Delete a few TimeEntries
     * const { count } = await prisma.timeEntry.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TimeEntryDeleteManyArgs>(args?: SelectSubset<T, TimeEntryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TimeEntries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TimeEntryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TimeEntries
     * const timeEntry = await prisma.timeEntry.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TimeEntryUpdateManyArgs>(args: SelectSubset<T, TimeEntryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one TimeEntry.
     * @param {TimeEntryUpsertArgs} args - Arguments to update or create a TimeEntry.
     * @example
     * // Update or create a TimeEntry
     * const timeEntry = await prisma.timeEntry.upsert({
     *   create: {
     *     // ... data to create a TimeEntry
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TimeEntry we want to update
     *   }
     * })
     */
    upsert<T extends TimeEntryUpsertArgs>(args: SelectSubset<T, TimeEntryUpsertArgs<ExtArgs>>): Prisma__TimeEntryClient<$Result.GetResult<Prisma.$TimeEntryPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of TimeEntries.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TimeEntryCountArgs} args - Arguments to filter TimeEntries to count.
     * @example
     * // Count the number of TimeEntries
     * const count = await prisma.timeEntry.count({
     *   where: {
     *     // ... the filter for the TimeEntries we want to count
     *   }
     * })
    **/
    count<T extends TimeEntryCountArgs>(
      args?: Subset<T, TimeEntryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TimeEntryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TimeEntry.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TimeEntryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TimeEntryAggregateArgs>(args: Subset<T, TimeEntryAggregateArgs>): Prisma.PrismaPromise<GetTimeEntryAggregateType<T>>

    /**
     * Group by TimeEntry.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TimeEntryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TimeEntryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TimeEntryGroupByArgs['orderBy'] }
        : { orderBy?: TimeEntryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TimeEntryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTimeEntryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TimeEntry model
   */
  readonly fields: TimeEntryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TimeEntry.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TimeEntryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    operator<T extends OperatorDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OperatorDefaultArgs<ExtArgs>>): Prisma__OperatorClient<$Result.GetResult<Prisma.$OperatorPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    project<T extends ProjectDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ProjectDefaultArgs<ExtArgs>>): Prisma__ProjectClient<$Result.GetResult<Prisma.$ProjectPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TimeEntry model
   */ 
  interface TimeEntryFieldRefs {
    readonly id: FieldRef<"TimeEntry", 'String'>
    readonly operatorId: FieldRef<"TimeEntry", 'String'>
    readonly projectId: FieldRef<"TimeEntry", 'String'>
    readonly fecha: FieldRef<"TimeEntry", 'String'>
    readonly horaIngreso: FieldRef<"TimeEntry", 'String'>
    readonly horaEgreso: FieldRef<"TimeEntry", 'String'>
    readonly horasTrabajadas: FieldRef<"TimeEntry", 'Float'>
    readonly estadoConfirmado: FieldRef<"TimeEntry", 'Boolean'>
    readonly confirmadoPorSupervisor: FieldRef<"TimeEntry", 'String'>
    readonly createdAt: FieldRef<"TimeEntry", 'DateTime'>
    readonly updatedAt: FieldRef<"TimeEntry", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TimeEntry findUnique
   */
  export type TimeEntryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * Filter, which TimeEntry to fetch.
     */
    where: TimeEntryWhereUniqueInput
  }

  /**
   * TimeEntry findUniqueOrThrow
   */
  export type TimeEntryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * Filter, which TimeEntry to fetch.
     */
    where: TimeEntryWhereUniqueInput
  }

  /**
   * TimeEntry findFirst
   */
  export type TimeEntryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * Filter, which TimeEntry to fetch.
     */
    where?: TimeEntryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TimeEntries to fetch.
     */
    orderBy?: TimeEntryOrderByWithRelationInput | TimeEntryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TimeEntries.
     */
    cursor?: TimeEntryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TimeEntries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TimeEntries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TimeEntries.
     */
    distinct?: TimeEntryScalarFieldEnum | TimeEntryScalarFieldEnum[]
  }

  /**
   * TimeEntry findFirstOrThrow
   */
  export type TimeEntryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * Filter, which TimeEntry to fetch.
     */
    where?: TimeEntryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TimeEntries to fetch.
     */
    orderBy?: TimeEntryOrderByWithRelationInput | TimeEntryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TimeEntries.
     */
    cursor?: TimeEntryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TimeEntries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TimeEntries.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TimeEntries.
     */
    distinct?: TimeEntryScalarFieldEnum | TimeEntryScalarFieldEnum[]
  }

  /**
   * TimeEntry findMany
   */
  export type TimeEntryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * Filter, which TimeEntries to fetch.
     */
    where?: TimeEntryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TimeEntries to fetch.
     */
    orderBy?: TimeEntryOrderByWithRelationInput | TimeEntryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TimeEntries.
     */
    cursor?: TimeEntryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TimeEntries from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TimeEntries.
     */
    skip?: number
    distinct?: TimeEntryScalarFieldEnum | TimeEntryScalarFieldEnum[]
  }

  /**
   * TimeEntry create
   */
  export type TimeEntryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * The data needed to create a TimeEntry.
     */
    data: XOR<TimeEntryCreateInput, TimeEntryUncheckedCreateInput>
  }

  /**
   * TimeEntry createMany
   */
  export type TimeEntryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TimeEntries.
     */
    data: TimeEntryCreateManyInput | TimeEntryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TimeEntry createManyAndReturn
   */
  export type TimeEntryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many TimeEntries.
     */
    data: TimeEntryCreateManyInput | TimeEntryCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * TimeEntry update
   */
  export type TimeEntryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * The data needed to update a TimeEntry.
     */
    data: XOR<TimeEntryUpdateInput, TimeEntryUncheckedUpdateInput>
    /**
     * Choose, which TimeEntry to update.
     */
    where: TimeEntryWhereUniqueInput
  }

  /**
   * TimeEntry updateMany
   */
  export type TimeEntryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TimeEntries.
     */
    data: XOR<TimeEntryUpdateManyMutationInput, TimeEntryUncheckedUpdateManyInput>
    /**
     * Filter which TimeEntries to update
     */
    where?: TimeEntryWhereInput
  }

  /**
   * TimeEntry upsert
   */
  export type TimeEntryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * The filter to search for the TimeEntry to update in case it exists.
     */
    where: TimeEntryWhereUniqueInput
    /**
     * In case the TimeEntry found by the `where` argument doesn't exist, create a new TimeEntry with this data.
     */
    create: XOR<TimeEntryCreateInput, TimeEntryUncheckedCreateInput>
    /**
     * In case the TimeEntry was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TimeEntryUpdateInput, TimeEntryUncheckedUpdateInput>
  }

  /**
   * TimeEntry delete
   */
  export type TimeEntryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
    /**
     * Filter which TimeEntry to delete.
     */
    where: TimeEntryWhereUniqueInput
  }

  /**
   * TimeEntry deleteMany
   */
  export type TimeEntryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TimeEntries to delete
     */
    where?: TimeEntryWhereInput
  }

  /**
   * TimeEntry without action
   */
  export type TimeEntryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TimeEntry
     */
    select?: TimeEntrySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TimeEntryInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const ProjectScalarFieldEnum: {
    id: 'id',
    nombre: 'nombre',
    activo: 'activo',
    observaciones: 'observaciones',
    horasEstimadas: 'horasEstimadas',
    horasConsumidas: 'horasConsumidas',
    cliente: 'cliente',
    clientId: 'clientId',
    responsable: 'responsable',
    estado: 'estado',
    fechaInicio: 'fechaInicio',
    fechaFin: 'fechaFin',
    createdAt: 'createdAt'
  };

  export type ProjectScalarFieldEnum = (typeof ProjectScalarFieldEnum)[keyof typeof ProjectScalarFieldEnum]


  export const ClientDelayScalarFieldEnum: {
    id: 'id',
    projectId: 'projectId',
    fecha: 'fecha',
    hora: 'hora',
    operador: 'operador',
    area: 'area',
    motivo: 'motivo',
    duracion: 'duracion',
    createdAt: 'createdAt'
  };

  export type ClientDelayScalarFieldEnum = (typeof ClientDelayScalarFieldEnum)[keyof typeof ClientDelayScalarFieldEnum]


  export const OperatorScalarFieldEnum: {
    id: 'id',
    nombreCompleto: 'nombreCompleto',
    activo: 'activo',
    etiquetas: 'etiquetas',
    pin: 'pin',
    role: 'role',
    createdAt: 'createdAt'
  };

  export type OperatorScalarFieldEnum = (typeof OperatorScalarFieldEnum)[keyof typeof OperatorScalarFieldEnum]


  export const FavoriteBlockScalarFieldEnum: {
    id: 'id',
    name: 'name',
    projectId: 'projectId',
    projectName: 'projectName',
    startTime: 'startTime',
    endTime: 'endTime',
    note: 'note',
    operatorIds: 'operatorIds',
    operatorNames: 'operatorNames',
    isNoteOnly: 'isNoteOnly'
  };

  export type FavoriteBlockScalarFieldEnum = (typeof FavoriteBlockScalarFieldEnum)[keyof typeof FavoriteBlockScalarFieldEnum]


  export const PlanningScalarFieldEnum: {
    id: 'id',
    fecha: 'fecha',
    blocks: 'blocks',
    createdAt: 'createdAt'
  };

  export type PlanningScalarFieldEnum = (typeof PlanningScalarFieldEnum)[keyof typeof PlanningScalarFieldEnum]


  export const HdbClientScalarFieldEnum: {
    id: 'id',
    nombre: 'nombre',
    email: 'email',
    telefono: 'telefono',
    direccion: 'direccion',
    activo: 'activo',
    createdAt: 'createdAt'
  };

  export type HdbClientScalarFieldEnum = (typeof HdbClientScalarFieldEnum)[keyof typeof HdbClientScalarFieldEnum]


  export const TimeEntryScalarFieldEnum: {
    id: 'id',
    operatorId: 'operatorId',
    projectId: 'projectId',
    fecha: 'fecha',
    horaIngreso: 'horaIngreso',
    horaEgreso: 'horaEgreso',
    horasTrabajadas: 'horasTrabajadas',
    estadoConfirmado: 'estadoConfirmado',
    confirmadoPorSupervisor: 'confirmadoPorSupervisor',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TimeEntryScalarFieldEnum = (typeof TimeEntryScalarFieldEnum)[keyof typeof TimeEntryScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    
  /**
   * Deep Input Types
   */


  export type ProjectWhereInput = {
    AND?: ProjectWhereInput | ProjectWhereInput[]
    OR?: ProjectWhereInput[]
    NOT?: ProjectWhereInput | ProjectWhereInput[]
    id?: StringFilter<"Project"> | string
    nombre?: StringFilter<"Project"> | string
    activo?: BoolFilter<"Project"> | boolean
    observaciones?: StringNullableFilter<"Project"> | string | null
    horasEstimadas?: IntFilter<"Project"> | number
    horasConsumidas?: IntFilter<"Project"> | number
    cliente?: StringNullableFilter<"Project"> | string | null
    clientId?: StringNullableFilter<"Project"> | string | null
    responsable?: StringNullableFilter<"Project"> | string | null
    estado?: StringFilter<"Project"> | string
    fechaInicio?: StringNullableFilter<"Project"> | string | null
    fechaFin?: StringNullableFilter<"Project"> | string | null
    createdAt?: DateTimeFilter<"Project"> | Date | string
    client?: XOR<HdbClientNullableRelationFilter, HdbClientWhereInput> | null
    clientDelays?: ClientDelayListRelationFilter
    timeEntries?: TimeEntryListRelationFilter
  }

  export type ProjectOrderByWithRelationInput = {
    id?: SortOrder
    nombre?: SortOrder
    activo?: SortOrder
    observaciones?: SortOrderInput | SortOrder
    horasEstimadas?: SortOrder
    horasConsumidas?: SortOrder
    cliente?: SortOrderInput | SortOrder
    clientId?: SortOrderInput | SortOrder
    responsable?: SortOrderInput | SortOrder
    estado?: SortOrder
    fechaInicio?: SortOrderInput | SortOrder
    fechaFin?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    client?: HdbClientOrderByWithRelationInput
    clientDelays?: ClientDelayOrderByRelationAggregateInput
    timeEntries?: TimeEntryOrderByRelationAggregateInput
  }

  export type ProjectWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ProjectWhereInput | ProjectWhereInput[]
    OR?: ProjectWhereInput[]
    NOT?: ProjectWhereInput | ProjectWhereInput[]
    nombre?: StringFilter<"Project"> | string
    activo?: BoolFilter<"Project"> | boolean
    observaciones?: StringNullableFilter<"Project"> | string | null
    horasEstimadas?: IntFilter<"Project"> | number
    horasConsumidas?: IntFilter<"Project"> | number
    cliente?: StringNullableFilter<"Project"> | string | null
    clientId?: StringNullableFilter<"Project"> | string | null
    responsable?: StringNullableFilter<"Project"> | string | null
    estado?: StringFilter<"Project"> | string
    fechaInicio?: StringNullableFilter<"Project"> | string | null
    fechaFin?: StringNullableFilter<"Project"> | string | null
    createdAt?: DateTimeFilter<"Project"> | Date | string
    client?: XOR<HdbClientNullableRelationFilter, HdbClientWhereInput> | null
    clientDelays?: ClientDelayListRelationFilter
    timeEntries?: TimeEntryListRelationFilter
  }, "id">

  export type ProjectOrderByWithAggregationInput = {
    id?: SortOrder
    nombre?: SortOrder
    activo?: SortOrder
    observaciones?: SortOrderInput | SortOrder
    horasEstimadas?: SortOrder
    horasConsumidas?: SortOrder
    cliente?: SortOrderInput | SortOrder
    clientId?: SortOrderInput | SortOrder
    responsable?: SortOrderInput | SortOrder
    estado?: SortOrder
    fechaInicio?: SortOrderInput | SortOrder
    fechaFin?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: ProjectCountOrderByAggregateInput
    _avg?: ProjectAvgOrderByAggregateInput
    _max?: ProjectMaxOrderByAggregateInput
    _min?: ProjectMinOrderByAggregateInput
    _sum?: ProjectSumOrderByAggregateInput
  }

  export type ProjectScalarWhereWithAggregatesInput = {
    AND?: ProjectScalarWhereWithAggregatesInput | ProjectScalarWhereWithAggregatesInput[]
    OR?: ProjectScalarWhereWithAggregatesInput[]
    NOT?: ProjectScalarWhereWithAggregatesInput | ProjectScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Project"> | string
    nombre?: StringWithAggregatesFilter<"Project"> | string
    activo?: BoolWithAggregatesFilter<"Project"> | boolean
    observaciones?: StringNullableWithAggregatesFilter<"Project"> | string | null
    horasEstimadas?: IntWithAggregatesFilter<"Project"> | number
    horasConsumidas?: IntWithAggregatesFilter<"Project"> | number
    cliente?: StringNullableWithAggregatesFilter<"Project"> | string | null
    clientId?: StringNullableWithAggregatesFilter<"Project"> | string | null
    responsable?: StringNullableWithAggregatesFilter<"Project"> | string | null
    estado?: StringWithAggregatesFilter<"Project"> | string
    fechaInicio?: StringNullableWithAggregatesFilter<"Project"> | string | null
    fechaFin?: StringNullableWithAggregatesFilter<"Project"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Project"> | Date | string
  }

  export type ClientDelayWhereInput = {
    AND?: ClientDelayWhereInput | ClientDelayWhereInput[]
    OR?: ClientDelayWhereInput[]
    NOT?: ClientDelayWhereInput | ClientDelayWhereInput[]
    id?: StringFilter<"ClientDelay"> | string
    projectId?: StringFilter<"ClientDelay"> | string
    fecha?: StringFilter<"ClientDelay"> | string
    hora?: StringFilter<"ClientDelay"> | string
    operador?: StringFilter<"ClientDelay"> | string
    area?: StringFilter<"ClientDelay"> | string
    motivo?: StringFilter<"ClientDelay"> | string
    duracion?: FloatFilter<"ClientDelay"> | number
    createdAt?: DateTimeFilter<"ClientDelay"> | Date | string
    project?: XOR<ProjectRelationFilter, ProjectWhereInput>
  }

  export type ClientDelayOrderByWithRelationInput = {
    id?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    hora?: SortOrder
    operador?: SortOrder
    area?: SortOrder
    motivo?: SortOrder
    duracion?: SortOrder
    createdAt?: SortOrder
    project?: ProjectOrderByWithRelationInput
  }

  export type ClientDelayWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ClientDelayWhereInput | ClientDelayWhereInput[]
    OR?: ClientDelayWhereInput[]
    NOT?: ClientDelayWhereInput | ClientDelayWhereInput[]
    projectId?: StringFilter<"ClientDelay"> | string
    fecha?: StringFilter<"ClientDelay"> | string
    hora?: StringFilter<"ClientDelay"> | string
    operador?: StringFilter<"ClientDelay"> | string
    area?: StringFilter<"ClientDelay"> | string
    motivo?: StringFilter<"ClientDelay"> | string
    duracion?: FloatFilter<"ClientDelay"> | number
    createdAt?: DateTimeFilter<"ClientDelay"> | Date | string
    project?: XOR<ProjectRelationFilter, ProjectWhereInput>
  }, "id">

  export type ClientDelayOrderByWithAggregationInput = {
    id?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    hora?: SortOrder
    operador?: SortOrder
    area?: SortOrder
    motivo?: SortOrder
    duracion?: SortOrder
    createdAt?: SortOrder
    _count?: ClientDelayCountOrderByAggregateInput
    _avg?: ClientDelayAvgOrderByAggregateInput
    _max?: ClientDelayMaxOrderByAggregateInput
    _min?: ClientDelayMinOrderByAggregateInput
    _sum?: ClientDelaySumOrderByAggregateInput
  }

  export type ClientDelayScalarWhereWithAggregatesInput = {
    AND?: ClientDelayScalarWhereWithAggregatesInput | ClientDelayScalarWhereWithAggregatesInput[]
    OR?: ClientDelayScalarWhereWithAggregatesInput[]
    NOT?: ClientDelayScalarWhereWithAggregatesInput | ClientDelayScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ClientDelay"> | string
    projectId?: StringWithAggregatesFilter<"ClientDelay"> | string
    fecha?: StringWithAggregatesFilter<"ClientDelay"> | string
    hora?: StringWithAggregatesFilter<"ClientDelay"> | string
    operador?: StringWithAggregatesFilter<"ClientDelay"> | string
    area?: StringWithAggregatesFilter<"ClientDelay"> | string
    motivo?: StringWithAggregatesFilter<"ClientDelay"> | string
    duracion?: FloatWithAggregatesFilter<"ClientDelay"> | number
    createdAt?: DateTimeWithAggregatesFilter<"ClientDelay"> | Date | string
  }

  export type OperatorWhereInput = {
    AND?: OperatorWhereInput | OperatorWhereInput[]
    OR?: OperatorWhereInput[]
    NOT?: OperatorWhereInput | OperatorWhereInput[]
    id?: StringFilter<"Operator"> | string
    nombreCompleto?: StringFilter<"Operator"> | string
    activo?: BoolFilter<"Operator"> | boolean
    etiquetas?: JsonFilter<"Operator">
    pin?: StringFilter<"Operator"> | string
    role?: StringFilter<"Operator"> | string
    createdAt?: DateTimeFilter<"Operator"> | Date | string
    timeEntries?: TimeEntryListRelationFilter
  }

  export type OperatorOrderByWithRelationInput = {
    id?: SortOrder
    nombreCompleto?: SortOrder
    activo?: SortOrder
    etiquetas?: SortOrder
    pin?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    timeEntries?: TimeEntryOrderByRelationAggregateInput
  }

  export type OperatorWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: OperatorWhereInput | OperatorWhereInput[]
    OR?: OperatorWhereInput[]
    NOT?: OperatorWhereInput | OperatorWhereInput[]
    nombreCompleto?: StringFilter<"Operator"> | string
    activo?: BoolFilter<"Operator"> | boolean
    etiquetas?: JsonFilter<"Operator">
    pin?: StringFilter<"Operator"> | string
    role?: StringFilter<"Operator"> | string
    createdAt?: DateTimeFilter<"Operator"> | Date | string
    timeEntries?: TimeEntryListRelationFilter
  }, "id">

  export type OperatorOrderByWithAggregationInput = {
    id?: SortOrder
    nombreCompleto?: SortOrder
    activo?: SortOrder
    etiquetas?: SortOrder
    pin?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    _count?: OperatorCountOrderByAggregateInput
    _max?: OperatorMaxOrderByAggregateInput
    _min?: OperatorMinOrderByAggregateInput
  }

  export type OperatorScalarWhereWithAggregatesInput = {
    AND?: OperatorScalarWhereWithAggregatesInput | OperatorScalarWhereWithAggregatesInput[]
    OR?: OperatorScalarWhereWithAggregatesInput[]
    NOT?: OperatorScalarWhereWithAggregatesInput | OperatorScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Operator"> | string
    nombreCompleto?: StringWithAggregatesFilter<"Operator"> | string
    activo?: BoolWithAggregatesFilter<"Operator"> | boolean
    etiquetas?: JsonWithAggregatesFilter<"Operator">
    pin?: StringWithAggregatesFilter<"Operator"> | string
    role?: StringWithAggregatesFilter<"Operator"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Operator"> | Date | string
  }

  export type FavoriteBlockWhereInput = {
    AND?: FavoriteBlockWhereInput | FavoriteBlockWhereInput[]
    OR?: FavoriteBlockWhereInput[]
    NOT?: FavoriteBlockWhereInput | FavoriteBlockWhereInput[]
    id?: StringFilter<"FavoriteBlock"> | string
    name?: StringFilter<"FavoriteBlock"> | string
    projectId?: StringNullableFilter<"FavoriteBlock"> | string | null
    projectName?: StringNullableFilter<"FavoriteBlock"> | string | null
    startTime?: StringNullableFilter<"FavoriteBlock"> | string | null
    endTime?: StringNullableFilter<"FavoriteBlock"> | string | null
    note?: StringNullableFilter<"FavoriteBlock"> | string | null
    operatorIds?: JsonNullableFilter<"FavoriteBlock">
    operatorNames?: JsonNullableFilter<"FavoriteBlock">
    isNoteOnly?: BoolFilter<"FavoriteBlock"> | boolean
  }

  export type FavoriteBlockOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    projectId?: SortOrderInput | SortOrder
    projectName?: SortOrderInput | SortOrder
    startTime?: SortOrderInput | SortOrder
    endTime?: SortOrderInput | SortOrder
    note?: SortOrderInput | SortOrder
    operatorIds?: SortOrderInput | SortOrder
    operatorNames?: SortOrderInput | SortOrder
    isNoteOnly?: SortOrder
  }

  export type FavoriteBlockWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: FavoriteBlockWhereInput | FavoriteBlockWhereInput[]
    OR?: FavoriteBlockWhereInput[]
    NOT?: FavoriteBlockWhereInput | FavoriteBlockWhereInput[]
    name?: StringFilter<"FavoriteBlock"> | string
    projectId?: StringNullableFilter<"FavoriteBlock"> | string | null
    projectName?: StringNullableFilter<"FavoriteBlock"> | string | null
    startTime?: StringNullableFilter<"FavoriteBlock"> | string | null
    endTime?: StringNullableFilter<"FavoriteBlock"> | string | null
    note?: StringNullableFilter<"FavoriteBlock"> | string | null
    operatorIds?: JsonNullableFilter<"FavoriteBlock">
    operatorNames?: JsonNullableFilter<"FavoriteBlock">
    isNoteOnly?: BoolFilter<"FavoriteBlock"> | boolean
  }, "id">

  export type FavoriteBlockOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    projectId?: SortOrderInput | SortOrder
    projectName?: SortOrderInput | SortOrder
    startTime?: SortOrderInput | SortOrder
    endTime?: SortOrderInput | SortOrder
    note?: SortOrderInput | SortOrder
    operatorIds?: SortOrderInput | SortOrder
    operatorNames?: SortOrderInput | SortOrder
    isNoteOnly?: SortOrder
    _count?: FavoriteBlockCountOrderByAggregateInput
    _max?: FavoriteBlockMaxOrderByAggregateInput
    _min?: FavoriteBlockMinOrderByAggregateInput
  }

  export type FavoriteBlockScalarWhereWithAggregatesInput = {
    AND?: FavoriteBlockScalarWhereWithAggregatesInput | FavoriteBlockScalarWhereWithAggregatesInput[]
    OR?: FavoriteBlockScalarWhereWithAggregatesInput[]
    NOT?: FavoriteBlockScalarWhereWithAggregatesInput | FavoriteBlockScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"FavoriteBlock"> | string
    name?: StringWithAggregatesFilter<"FavoriteBlock"> | string
    projectId?: StringNullableWithAggregatesFilter<"FavoriteBlock"> | string | null
    projectName?: StringNullableWithAggregatesFilter<"FavoriteBlock"> | string | null
    startTime?: StringNullableWithAggregatesFilter<"FavoriteBlock"> | string | null
    endTime?: StringNullableWithAggregatesFilter<"FavoriteBlock"> | string | null
    note?: StringNullableWithAggregatesFilter<"FavoriteBlock"> | string | null
    operatorIds?: JsonNullableWithAggregatesFilter<"FavoriteBlock">
    operatorNames?: JsonNullableWithAggregatesFilter<"FavoriteBlock">
    isNoteOnly?: BoolWithAggregatesFilter<"FavoriteBlock"> | boolean
  }

  export type PlanningWhereInput = {
    AND?: PlanningWhereInput | PlanningWhereInput[]
    OR?: PlanningWhereInput[]
    NOT?: PlanningWhereInput | PlanningWhereInput[]
    id?: StringFilter<"Planning"> | string
    fecha?: StringFilter<"Planning"> | string
    blocks?: JsonFilter<"Planning">
    createdAt?: DateTimeFilter<"Planning"> | Date | string
  }

  export type PlanningOrderByWithRelationInput = {
    id?: SortOrder
    fecha?: SortOrder
    blocks?: SortOrder
    createdAt?: SortOrder
  }

  export type PlanningWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    fecha?: string
    AND?: PlanningWhereInput | PlanningWhereInput[]
    OR?: PlanningWhereInput[]
    NOT?: PlanningWhereInput | PlanningWhereInput[]
    blocks?: JsonFilter<"Planning">
    createdAt?: DateTimeFilter<"Planning"> | Date | string
  }, "id" | "fecha">

  export type PlanningOrderByWithAggregationInput = {
    id?: SortOrder
    fecha?: SortOrder
    blocks?: SortOrder
    createdAt?: SortOrder
    _count?: PlanningCountOrderByAggregateInput
    _max?: PlanningMaxOrderByAggregateInput
    _min?: PlanningMinOrderByAggregateInput
  }

  export type PlanningScalarWhereWithAggregatesInput = {
    AND?: PlanningScalarWhereWithAggregatesInput | PlanningScalarWhereWithAggregatesInput[]
    OR?: PlanningScalarWhereWithAggregatesInput[]
    NOT?: PlanningScalarWhereWithAggregatesInput | PlanningScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Planning"> | string
    fecha?: StringWithAggregatesFilter<"Planning"> | string
    blocks?: JsonWithAggregatesFilter<"Planning">
    createdAt?: DateTimeWithAggregatesFilter<"Planning"> | Date | string
  }

  export type HdbClientWhereInput = {
    AND?: HdbClientWhereInput | HdbClientWhereInput[]
    OR?: HdbClientWhereInput[]
    NOT?: HdbClientWhereInput | HdbClientWhereInput[]
    id?: StringFilter<"HdbClient"> | string
    nombre?: StringFilter<"HdbClient"> | string
    email?: StringNullableFilter<"HdbClient"> | string | null
    telefono?: StringNullableFilter<"HdbClient"> | string | null
    direccion?: StringNullableFilter<"HdbClient"> | string | null
    activo?: BoolFilter<"HdbClient"> | boolean
    createdAt?: DateTimeFilter<"HdbClient"> | Date | string
    projects?: ProjectListRelationFilter
  }

  export type HdbClientOrderByWithRelationInput = {
    id?: SortOrder
    nombre?: SortOrder
    email?: SortOrderInput | SortOrder
    telefono?: SortOrderInput | SortOrder
    direccion?: SortOrderInput | SortOrder
    activo?: SortOrder
    createdAt?: SortOrder
    projects?: ProjectOrderByRelationAggregateInput
  }

  export type HdbClientWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: HdbClientWhereInput | HdbClientWhereInput[]
    OR?: HdbClientWhereInput[]
    NOT?: HdbClientWhereInput | HdbClientWhereInput[]
    nombre?: StringFilter<"HdbClient"> | string
    email?: StringNullableFilter<"HdbClient"> | string | null
    telefono?: StringNullableFilter<"HdbClient"> | string | null
    direccion?: StringNullableFilter<"HdbClient"> | string | null
    activo?: BoolFilter<"HdbClient"> | boolean
    createdAt?: DateTimeFilter<"HdbClient"> | Date | string
    projects?: ProjectListRelationFilter
  }, "id">

  export type HdbClientOrderByWithAggregationInput = {
    id?: SortOrder
    nombre?: SortOrder
    email?: SortOrderInput | SortOrder
    telefono?: SortOrderInput | SortOrder
    direccion?: SortOrderInput | SortOrder
    activo?: SortOrder
    createdAt?: SortOrder
    _count?: HdbClientCountOrderByAggregateInput
    _max?: HdbClientMaxOrderByAggregateInput
    _min?: HdbClientMinOrderByAggregateInput
  }

  export type HdbClientScalarWhereWithAggregatesInput = {
    AND?: HdbClientScalarWhereWithAggregatesInput | HdbClientScalarWhereWithAggregatesInput[]
    OR?: HdbClientScalarWhereWithAggregatesInput[]
    NOT?: HdbClientScalarWhereWithAggregatesInput | HdbClientScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"HdbClient"> | string
    nombre?: StringWithAggregatesFilter<"HdbClient"> | string
    email?: StringNullableWithAggregatesFilter<"HdbClient"> | string | null
    telefono?: StringNullableWithAggregatesFilter<"HdbClient"> | string | null
    direccion?: StringNullableWithAggregatesFilter<"HdbClient"> | string | null
    activo?: BoolWithAggregatesFilter<"HdbClient"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"HdbClient"> | Date | string
  }

  export type TimeEntryWhereInput = {
    AND?: TimeEntryWhereInput | TimeEntryWhereInput[]
    OR?: TimeEntryWhereInput[]
    NOT?: TimeEntryWhereInput | TimeEntryWhereInput[]
    id?: StringFilter<"TimeEntry"> | string
    operatorId?: StringFilter<"TimeEntry"> | string
    projectId?: StringFilter<"TimeEntry"> | string
    fecha?: StringFilter<"TimeEntry"> | string
    horaIngreso?: StringNullableFilter<"TimeEntry"> | string | null
    horaEgreso?: StringNullableFilter<"TimeEntry"> | string | null
    horasTrabajadas?: FloatFilter<"TimeEntry"> | number
    estadoConfirmado?: BoolFilter<"TimeEntry"> | boolean
    confirmadoPorSupervisor?: StringNullableFilter<"TimeEntry"> | string | null
    createdAt?: DateTimeFilter<"TimeEntry"> | Date | string
    updatedAt?: DateTimeFilter<"TimeEntry"> | Date | string
    operator?: XOR<OperatorRelationFilter, OperatorWhereInput>
    project?: XOR<ProjectRelationFilter, ProjectWhereInput>
  }

  export type TimeEntryOrderByWithRelationInput = {
    id?: SortOrder
    operatorId?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    horaIngreso?: SortOrderInput | SortOrder
    horaEgreso?: SortOrderInput | SortOrder
    horasTrabajadas?: SortOrder
    estadoConfirmado?: SortOrder
    confirmadoPorSupervisor?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    operator?: OperatorOrderByWithRelationInput
    project?: ProjectOrderByWithRelationInput
  }

  export type TimeEntryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TimeEntryWhereInput | TimeEntryWhereInput[]
    OR?: TimeEntryWhereInput[]
    NOT?: TimeEntryWhereInput | TimeEntryWhereInput[]
    operatorId?: StringFilter<"TimeEntry"> | string
    projectId?: StringFilter<"TimeEntry"> | string
    fecha?: StringFilter<"TimeEntry"> | string
    horaIngreso?: StringNullableFilter<"TimeEntry"> | string | null
    horaEgreso?: StringNullableFilter<"TimeEntry"> | string | null
    horasTrabajadas?: FloatFilter<"TimeEntry"> | number
    estadoConfirmado?: BoolFilter<"TimeEntry"> | boolean
    confirmadoPorSupervisor?: StringNullableFilter<"TimeEntry"> | string | null
    createdAt?: DateTimeFilter<"TimeEntry"> | Date | string
    updatedAt?: DateTimeFilter<"TimeEntry"> | Date | string
    operator?: XOR<OperatorRelationFilter, OperatorWhereInput>
    project?: XOR<ProjectRelationFilter, ProjectWhereInput>
  }, "id">

  export type TimeEntryOrderByWithAggregationInput = {
    id?: SortOrder
    operatorId?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    horaIngreso?: SortOrderInput | SortOrder
    horaEgreso?: SortOrderInput | SortOrder
    horasTrabajadas?: SortOrder
    estadoConfirmado?: SortOrder
    confirmadoPorSupervisor?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TimeEntryCountOrderByAggregateInput
    _avg?: TimeEntryAvgOrderByAggregateInput
    _max?: TimeEntryMaxOrderByAggregateInput
    _min?: TimeEntryMinOrderByAggregateInput
    _sum?: TimeEntrySumOrderByAggregateInput
  }

  export type TimeEntryScalarWhereWithAggregatesInput = {
    AND?: TimeEntryScalarWhereWithAggregatesInput | TimeEntryScalarWhereWithAggregatesInput[]
    OR?: TimeEntryScalarWhereWithAggregatesInput[]
    NOT?: TimeEntryScalarWhereWithAggregatesInput | TimeEntryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TimeEntry"> | string
    operatorId?: StringWithAggregatesFilter<"TimeEntry"> | string
    projectId?: StringWithAggregatesFilter<"TimeEntry"> | string
    fecha?: StringWithAggregatesFilter<"TimeEntry"> | string
    horaIngreso?: StringNullableWithAggregatesFilter<"TimeEntry"> | string | null
    horaEgreso?: StringNullableWithAggregatesFilter<"TimeEntry"> | string | null
    horasTrabajadas?: FloatWithAggregatesFilter<"TimeEntry"> | number
    estadoConfirmado?: BoolWithAggregatesFilter<"TimeEntry"> | boolean
    confirmadoPorSupervisor?: StringNullableWithAggregatesFilter<"TimeEntry"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"TimeEntry"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TimeEntry"> | Date | string
  }

  export type ProjectCreateInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
    client?: HdbClientCreateNestedOneWithoutProjectsInput
    clientDelays?: ClientDelayCreateNestedManyWithoutProjectInput
    timeEntries?: TimeEntryCreateNestedManyWithoutProjectInput
  }

  export type ProjectUncheckedCreateInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    clientId?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
    clientDelays?: ClientDelayUncheckedCreateNestedManyWithoutProjectInput
    timeEntries?: TimeEntryUncheckedCreateNestedManyWithoutProjectInput
  }

  export type ProjectUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    client?: HdbClientUpdateOneWithoutProjectsNestedInput
    clientDelays?: ClientDelayUpdateManyWithoutProjectNestedInput
    timeEntries?: TimeEntryUpdateManyWithoutProjectNestedInput
  }

  export type ProjectUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    clientId?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clientDelays?: ClientDelayUncheckedUpdateManyWithoutProjectNestedInput
    timeEntries?: TimeEntryUncheckedUpdateManyWithoutProjectNestedInput
  }

  export type ProjectCreateManyInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    clientId?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
  }

  export type ProjectUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProjectUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    clientId?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClientDelayCreateInput = {
    id?: string
    fecha: string
    hora: string
    operador: string
    area: string
    motivo: string
    duracion: number
    createdAt?: Date | string
    project: ProjectCreateNestedOneWithoutClientDelaysInput
  }

  export type ClientDelayUncheckedCreateInput = {
    id?: string
    projectId: string
    fecha: string
    hora: string
    operador: string
    area: string
    motivo: string
    duracion: number
    createdAt?: Date | string
  }

  export type ClientDelayUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    hora?: StringFieldUpdateOperationsInput | string
    operador?: StringFieldUpdateOperationsInput | string
    area?: StringFieldUpdateOperationsInput | string
    motivo?: StringFieldUpdateOperationsInput | string
    duracion?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    project?: ProjectUpdateOneRequiredWithoutClientDelaysNestedInput
  }

  export type ClientDelayUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    projectId?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    hora?: StringFieldUpdateOperationsInput | string
    operador?: StringFieldUpdateOperationsInput | string
    area?: StringFieldUpdateOperationsInput | string
    motivo?: StringFieldUpdateOperationsInput | string
    duracion?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClientDelayCreateManyInput = {
    id?: string
    projectId: string
    fecha: string
    hora: string
    operador: string
    area: string
    motivo: string
    duracion: number
    createdAt?: Date | string
  }

  export type ClientDelayUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    hora?: StringFieldUpdateOperationsInput | string
    operador?: StringFieldUpdateOperationsInput | string
    area?: StringFieldUpdateOperationsInput | string
    motivo?: StringFieldUpdateOperationsInput | string
    duracion?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClientDelayUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    projectId?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    hora?: StringFieldUpdateOperationsInput | string
    operador?: StringFieldUpdateOperationsInput | string
    area?: StringFieldUpdateOperationsInput | string
    motivo?: StringFieldUpdateOperationsInput | string
    duracion?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OperatorCreateInput = {
    id?: string
    nombreCompleto: string
    activo?: boolean
    etiquetas: JsonNullValueInput | InputJsonValue
    pin?: string
    role?: string
    createdAt?: Date | string
    timeEntries?: TimeEntryCreateNestedManyWithoutOperatorInput
  }

  export type OperatorUncheckedCreateInput = {
    id?: string
    nombreCompleto: string
    activo?: boolean
    etiquetas: JsonNullValueInput | InputJsonValue
    pin?: string
    role?: string
    createdAt?: Date | string
    timeEntries?: TimeEntryUncheckedCreateNestedManyWithoutOperatorInput
  }

  export type OperatorUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    etiquetas?: JsonNullValueInput | InputJsonValue
    pin?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    timeEntries?: TimeEntryUpdateManyWithoutOperatorNestedInput
  }

  export type OperatorUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    etiquetas?: JsonNullValueInput | InputJsonValue
    pin?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    timeEntries?: TimeEntryUncheckedUpdateManyWithoutOperatorNestedInput
  }

  export type OperatorCreateManyInput = {
    id?: string
    nombreCompleto: string
    activo?: boolean
    etiquetas: JsonNullValueInput | InputJsonValue
    pin?: string
    role?: string
    createdAt?: Date | string
  }

  export type OperatorUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    etiquetas?: JsonNullValueInput | InputJsonValue
    pin?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OperatorUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    etiquetas?: JsonNullValueInput | InputJsonValue
    pin?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FavoriteBlockCreateInput = {
    id?: string
    name: string
    projectId?: string | null
    projectName?: string | null
    startTime?: string | null
    endTime?: string | null
    note?: string | null
    operatorIds?: NullableJsonNullValueInput | InputJsonValue
    operatorNames?: NullableJsonNullValueInput | InputJsonValue
    isNoteOnly?: boolean
  }

  export type FavoriteBlockUncheckedCreateInput = {
    id?: string
    name: string
    projectId?: string | null
    projectName?: string | null
    startTime?: string | null
    endTime?: string | null
    note?: string | null
    operatorIds?: NullableJsonNullValueInput | InputJsonValue
    operatorNames?: NullableJsonNullValueInput | InputJsonValue
    isNoteOnly?: boolean
  }

  export type FavoriteBlockUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    projectName?: NullableStringFieldUpdateOperationsInput | string | null
    startTime?: NullableStringFieldUpdateOperationsInput | string | null
    endTime?: NullableStringFieldUpdateOperationsInput | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
    operatorIds?: NullableJsonNullValueInput | InputJsonValue
    operatorNames?: NullableJsonNullValueInput | InputJsonValue
    isNoteOnly?: BoolFieldUpdateOperationsInput | boolean
  }

  export type FavoriteBlockUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    projectName?: NullableStringFieldUpdateOperationsInput | string | null
    startTime?: NullableStringFieldUpdateOperationsInput | string | null
    endTime?: NullableStringFieldUpdateOperationsInput | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
    operatorIds?: NullableJsonNullValueInput | InputJsonValue
    operatorNames?: NullableJsonNullValueInput | InputJsonValue
    isNoteOnly?: BoolFieldUpdateOperationsInput | boolean
  }

  export type FavoriteBlockCreateManyInput = {
    id?: string
    name: string
    projectId?: string | null
    projectName?: string | null
    startTime?: string | null
    endTime?: string | null
    note?: string | null
    operatorIds?: NullableJsonNullValueInput | InputJsonValue
    operatorNames?: NullableJsonNullValueInput | InputJsonValue
    isNoteOnly?: boolean
  }

  export type FavoriteBlockUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    projectName?: NullableStringFieldUpdateOperationsInput | string | null
    startTime?: NullableStringFieldUpdateOperationsInput | string | null
    endTime?: NullableStringFieldUpdateOperationsInput | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
    operatorIds?: NullableJsonNullValueInput | InputJsonValue
    operatorNames?: NullableJsonNullValueInput | InputJsonValue
    isNoteOnly?: BoolFieldUpdateOperationsInput | boolean
  }

  export type FavoriteBlockUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    projectId?: NullableStringFieldUpdateOperationsInput | string | null
    projectName?: NullableStringFieldUpdateOperationsInput | string | null
    startTime?: NullableStringFieldUpdateOperationsInput | string | null
    endTime?: NullableStringFieldUpdateOperationsInput | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
    operatorIds?: NullableJsonNullValueInput | InputJsonValue
    operatorNames?: NullableJsonNullValueInput | InputJsonValue
    isNoteOnly?: BoolFieldUpdateOperationsInput | boolean
  }

  export type PlanningCreateInput = {
    id?: string
    fecha: string
    blocks: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type PlanningUncheckedCreateInput = {
    id?: string
    fecha: string
    blocks: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type PlanningUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    blocks?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanningUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    blocks?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanningCreateManyInput = {
    id?: string
    fecha: string
    blocks: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type PlanningUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    blocks?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanningUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    blocks?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HdbClientCreateInput = {
    id?: string
    nombre: string
    email?: string | null
    telefono?: string | null
    direccion?: string | null
    activo?: boolean
    createdAt?: Date | string
    projects?: ProjectCreateNestedManyWithoutClientInput
  }

  export type HdbClientUncheckedCreateInput = {
    id?: string
    nombre: string
    email?: string | null
    telefono?: string | null
    direccion?: string | null
    activo?: boolean
    createdAt?: Date | string
    projects?: ProjectUncheckedCreateNestedManyWithoutClientInput
  }

  export type HdbClientUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    telefono?: NullableStringFieldUpdateOperationsInput | string | null
    direccion?: NullableStringFieldUpdateOperationsInput | string | null
    activo?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    projects?: ProjectUpdateManyWithoutClientNestedInput
  }

  export type HdbClientUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    telefono?: NullableStringFieldUpdateOperationsInput | string | null
    direccion?: NullableStringFieldUpdateOperationsInput | string | null
    activo?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    projects?: ProjectUncheckedUpdateManyWithoutClientNestedInput
  }

  export type HdbClientCreateManyInput = {
    id?: string
    nombre: string
    email?: string | null
    telefono?: string | null
    direccion?: string | null
    activo?: boolean
    createdAt?: Date | string
  }

  export type HdbClientUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    telefono?: NullableStringFieldUpdateOperationsInput | string | null
    direccion?: NullableStringFieldUpdateOperationsInput | string | null
    activo?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HdbClientUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    telefono?: NullableStringFieldUpdateOperationsInput | string | null
    direccion?: NullableStringFieldUpdateOperationsInput | string | null
    activo?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TimeEntryCreateInput = {
    id?: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    operator: OperatorCreateNestedOneWithoutTimeEntriesInput
    project: ProjectCreateNestedOneWithoutTimeEntriesInput
  }

  export type TimeEntryUncheckedCreateInput = {
    id?: string
    operatorId: string
    projectId: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TimeEntryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    operator?: OperatorUpdateOneRequiredWithoutTimeEntriesNestedInput
    project?: ProjectUpdateOneRequiredWithoutTimeEntriesNestedInput
  }

  export type TimeEntryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    operatorId?: StringFieldUpdateOperationsInput | string
    projectId?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TimeEntryCreateManyInput = {
    id?: string
    operatorId: string
    projectId: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TimeEntryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TimeEntryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    operatorId?: StringFieldUpdateOperationsInput | string
    projectId?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type HdbClientNullableRelationFilter = {
    is?: HdbClientWhereInput | null
    isNot?: HdbClientWhereInput | null
  }

  export type ClientDelayListRelationFilter = {
    every?: ClientDelayWhereInput
    some?: ClientDelayWhereInput
    none?: ClientDelayWhereInput
  }

  export type TimeEntryListRelationFilter = {
    every?: TimeEntryWhereInput
    some?: TimeEntryWhereInput
    none?: TimeEntryWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ClientDelayOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TimeEntryOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ProjectCountOrderByAggregateInput = {
    id?: SortOrder
    nombre?: SortOrder
    activo?: SortOrder
    observaciones?: SortOrder
    horasEstimadas?: SortOrder
    horasConsumidas?: SortOrder
    cliente?: SortOrder
    clientId?: SortOrder
    responsable?: SortOrder
    estado?: SortOrder
    fechaInicio?: SortOrder
    fechaFin?: SortOrder
    createdAt?: SortOrder
  }

  export type ProjectAvgOrderByAggregateInput = {
    horasEstimadas?: SortOrder
    horasConsumidas?: SortOrder
  }

  export type ProjectMaxOrderByAggregateInput = {
    id?: SortOrder
    nombre?: SortOrder
    activo?: SortOrder
    observaciones?: SortOrder
    horasEstimadas?: SortOrder
    horasConsumidas?: SortOrder
    cliente?: SortOrder
    clientId?: SortOrder
    responsable?: SortOrder
    estado?: SortOrder
    fechaInicio?: SortOrder
    fechaFin?: SortOrder
    createdAt?: SortOrder
  }

  export type ProjectMinOrderByAggregateInput = {
    id?: SortOrder
    nombre?: SortOrder
    activo?: SortOrder
    observaciones?: SortOrder
    horasEstimadas?: SortOrder
    horasConsumidas?: SortOrder
    cliente?: SortOrder
    clientId?: SortOrder
    responsable?: SortOrder
    estado?: SortOrder
    fechaInicio?: SortOrder
    fechaFin?: SortOrder
    createdAt?: SortOrder
  }

  export type ProjectSumOrderByAggregateInput = {
    horasEstimadas?: SortOrder
    horasConsumidas?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type ProjectRelationFilter = {
    is?: ProjectWhereInput
    isNot?: ProjectWhereInput
  }

  export type ClientDelayCountOrderByAggregateInput = {
    id?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    hora?: SortOrder
    operador?: SortOrder
    area?: SortOrder
    motivo?: SortOrder
    duracion?: SortOrder
    createdAt?: SortOrder
  }

  export type ClientDelayAvgOrderByAggregateInput = {
    duracion?: SortOrder
  }

  export type ClientDelayMaxOrderByAggregateInput = {
    id?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    hora?: SortOrder
    operador?: SortOrder
    area?: SortOrder
    motivo?: SortOrder
    duracion?: SortOrder
    createdAt?: SortOrder
  }

  export type ClientDelayMinOrderByAggregateInput = {
    id?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    hora?: SortOrder
    operador?: SortOrder
    area?: SortOrder
    motivo?: SortOrder
    duracion?: SortOrder
    createdAt?: SortOrder
  }

  export type ClientDelaySumOrderByAggregateInput = {
    duracion?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }
  export type JsonFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type OperatorCountOrderByAggregateInput = {
    id?: SortOrder
    nombreCompleto?: SortOrder
    activo?: SortOrder
    etiquetas?: SortOrder
    pin?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
  }

  export type OperatorMaxOrderByAggregateInput = {
    id?: SortOrder
    nombreCompleto?: SortOrder
    activo?: SortOrder
    pin?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
  }

  export type OperatorMinOrderByAggregateInput = {
    id?: SortOrder
    nombreCompleto?: SortOrder
    activo?: SortOrder
    pin?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }
  export type JsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type FavoriteBlockCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    projectId?: SortOrder
    projectName?: SortOrder
    startTime?: SortOrder
    endTime?: SortOrder
    note?: SortOrder
    operatorIds?: SortOrder
    operatorNames?: SortOrder
    isNoteOnly?: SortOrder
  }

  export type FavoriteBlockMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    projectId?: SortOrder
    projectName?: SortOrder
    startTime?: SortOrder
    endTime?: SortOrder
    note?: SortOrder
    isNoteOnly?: SortOrder
  }

  export type FavoriteBlockMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    projectId?: SortOrder
    projectName?: SortOrder
    startTime?: SortOrder
    endTime?: SortOrder
    note?: SortOrder
    isNoteOnly?: SortOrder
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type PlanningCountOrderByAggregateInput = {
    id?: SortOrder
    fecha?: SortOrder
    blocks?: SortOrder
    createdAt?: SortOrder
  }

  export type PlanningMaxOrderByAggregateInput = {
    id?: SortOrder
    fecha?: SortOrder
    createdAt?: SortOrder
  }

  export type PlanningMinOrderByAggregateInput = {
    id?: SortOrder
    fecha?: SortOrder
    createdAt?: SortOrder
  }

  export type ProjectListRelationFilter = {
    every?: ProjectWhereInput
    some?: ProjectWhereInput
    none?: ProjectWhereInput
  }

  export type ProjectOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type HdbClientCountOrderByAggregateInput = {
    id?: SortOrder
    nombre?: SortOrder
    email?: SortOrder
    telefono?: SortOrder
    direccion?: SortOrder
    activo?: SortOrder
    createdAt?: SortOrder
  }

  export type HdbClientMaxOrderByAggregateInput = {
    id?: SortOrder
    nombre?: SortOrder
    email?: SortOrder
    telefono?: SortOrder
    direccion?: SortOrder
    activo?: SortOrder
    createdAt?: SortOrder
  }

  export type HdbClientMinOrderByAggregateInput = {
    id?: SortOrder
    nombre?: SortOrder
    email?: SortOrder
    telefono?: SortOrder
    direccion?: SortOrder
    activo?: SortOrder
    createdAt?: SortOrder
  }

  export type OperatorRelationFilter = {
    is?: OperatorWhereInput
    isNot?: OperatorWhereInput
  }

  export type TimeEntryCountOrderByAggregateInput = {
    id?: SortOrder
    operatorId?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    horaIngreso?: SortOrder
    horaEgreso?: SortOrder
    horasTrabajadas?: SortOrder
    estadoConfirmado?: SortOrder
    confirmadoPorSupervisor?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TimeEntryAvgOrderByAggregateInput = {
    horasTrabajadas?: SortOrder
  }

  export type TimeEntryMaxOrderByAggregateInput = {
    id?: SortOrder
    operatorId?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    horaIngreso?: SortOrder
    horaEgreso?: SortOrder
    horasTrabajadas?: SortOrder
    estadoConfirmado?: SortOrder
    confirmadoPorSupervisor?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TimeEntryMinOrderByAggregateInput = {
    id?: SortOrder
    operatorId?: SortOrder
    projectId?: SortOrder
    fecha?: SortOrder
    horaIngreso?: SortOrder
    horaEgreso?: SortOrder
    horasTrabajadas?: SortOrder
    estadoConfirmado?: SortOrder
    confirmadoPorSupervisor?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TimeEntrySumOrderByAggregateInput = {
    horasTrabajadas?: SortOrder
  }

  export type HdbClientCreateNestedOneWithoutProjectsInput = {
    create?: XOR<HdbClientCreateWithoutProjectsInput, HdbClientUncheckedCreateWithoutProjectsInput>
    connectOrCreate?: HdbClientCreateOrConnectWithoutProjectsInput
    connect?: HdbClientWhereUniqueInput
  }

  export type ClientDelayCreateNestedManyWithoutProjectInput = {
    create?: XOR<ClientDelayCreateWithoutProjectInput, ClientDelayUncheckedCreateWithoutProjectInput> | ClientDelayCreateWithoutProjectInput[] | ClientDelayUncheckedCreateWithoutProjectInput[]
    connectOrCreate?: ClientDelayCreateOrConnectWithoutProjectInput | ClientDelayCreateOrConnectWithoutProjectInput[]
    createMany?: ClientDelayCreateManyProjectInputEnvelope
    connect?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
  }

  export type TimeEntryCreateNestedManyWithoutProjectInput = {
    create?: XOR<TimeEntryCreateWithoutProjectInput, TimeEntryUncheckedCreateWithoutProjectInput> | TimeEntryCreateWithoutProjectInput[] | TimeEntryUncheckedCreateWithoutProjectInput[]
    connectOrCreate?: TimeEntryCreateOrConnectWithoutProjectInput | TimeEntryCreateOrConnectWithoutProjectInput[]
    createMany?: TimeEntryCreateManyProjectInputEnvelope
    connect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
  }

  export type ClientDelayUncheckedCreateNestedManyWithoutProjectInput = {
    create?: XOR<ClientDelayCreateWithoutProjectInput, ClientDelayUncheckedCreateWithoutProjectInput> | ClientDelayCreateWithoutProjectInput[] | ClientDelayUncheckedCreateWithoutProjectInput[]
    connectOrCreate?: ClientDelayCreateOrConnectWithoutProjectInput | ClientDelayCreateOrConnectWithoutProjectInput[]
    createMany?: ClientDelayCreateManyProjectInputEnvelope
    connect?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
  }

  export type TimeEntryUncheckedCreateNestedManyWithoutProjectInput = {
    create?: XOR<TimeEntryCreateWithoutProjectInput, TimeEntryUncheckedCreateWithoutProjectInput> | TimeEntryCreateWithoutProjectInput[] | TimeEntryUncheckedCreateWithoutProjectInput[]
    connectOrCreate?: TimeEntryCreateOrConnectWithoutProjectInput | TimeEntryCreateOrConnectWithoutProjectInput[]
    createMany?: TimeEntryCreateManyProjectInputEnvelope
    connect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type HdbClientUpdateOneWithoutProjectsNestedInput = {
    create?: XOR<HdbClientCreateWithoutProjectsInput, HdbClientUncheckedCreateWithoutProjectsInput>
    connectOrCreate?: HdbClientCreateOrConnectWithoutProjectsInput
    upsert?: HdbClientUpsertWithoutProjectsInput
    disconnect?: HdbClientWhereInput | boolean
    delete?: HdbClientWhereInput | boolean
    connect?: HdbClientWhereUniqueInput
    update?: XOR<XOR<HdbClientUpdateToOneWithWhereWithoutProjectsInput, HdbClientUpdateWithoutProjectsInput>, HdbClientUncheckedUpdateWithoutProjectsInput>
  }

  export type ClientDelayUpdateManyWithoutProjectNestedInput = {
    create?: XOR<ClientDelayCreateWithoutProjectInput, ClientDelayUncheckedCreateWithoutProjectInput> | ClientDelayCreateWithoutProjectInput[] | ClientDelayUncheckedCreateWithoutProjectInput[]
    connectOrCreate?: ClientDelayCreateOrConnectWithoutProjectInput | ClientDelayCreateOrConnectWithoutProjectInput[]
    upsert?: ClientDelayUpsertWithWhereUniqueWithoutProjectInput | ClientDelayUpsertWithWhereUniqueWithoutProjectInput[]
    createMany?: ClientDelayCreateManyProjectInputEnvelope
    set?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
    disconnect?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
    delete?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
    connect?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
    update?: ClientDelayUpdateWithWhereUniqueWithoutProjectInput | ClientDelayUpdateWithWhereUniqueWithoutProjectInput[]
    updateMany?: ClientDelayUpdateManyWithWhereWithoutProjectInput | ClientDelayUpdateManyWithWhereWithoutProjectInput[]
    deleteMany?: ClientDelayScalarWhereInput | ClientDelayScalarWhereInput[]
  }

  export type TimeEntryUpdateManyWithoutProjectNestedInput = {
    create?: XOR<TimeEntryCreateWithoutProjectInput, TimeEntryUncheckedCreateWithoutProjectInput> | TimeEntryCreateWithoutProjectInput[] | TimeEntryUncheckedCreateWithoutProjectInput[]
    connectOrCreate?: TimeEntryCreateOrConnectWithoutProjectInput | TimeEntryCreateOrConnectWithoutProjectInput[]
    upsert?: TimeEntryUpsertWithWhereUniqueWithoutProjectInput | TimeEntryUpsertWithWhereUniqueWithoutProjectInput[]
    createMany?: TimeEntryCreateManyProjectInputEnvelope
    set?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    disconnect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    delete?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    connect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    update?: TimeEntryUpdateWithWhereUniqueWithoutProjectInput | TimeEntryUpdateWithWhereUniqueWithoutProjectInput[]
    updateMany?: TimeEntryUpdateManyWithWhereWithoutProjectInput | TimeEntryUpdateManyWithWhereWithoutProjectInput[]
    deleteMany?: TimeEntryScalarWhereInput | TimeEntryScalarWhereInput[]
  }

  export type ClientDelayUncheckedUpdateManyWithoutProjectNestedInput = {
    create?: XOR<ClientDelayCreateWithoutProjectInput, ClientDelayUncheckedCreateWithoutProjectInput> | ClientDelayCreateWithoutProjectInput[] | ClientDelayUncheckedCreateWithoutProjectInput[]
    connectOrCreate?: ClientDelayCreateOrConnectWithoutProjectInput | ClientDelayCreateOrConnectWithoutProjectInput[]
    upsert?: ClientDelayUpsertWithWhereUniqueWithoutProjectInput | ClientDelayUpsertWithWhereUniqueWithoutProjectInput[]
    createMany?: ClientDelayCreateManyProjectInputEnvelope
    set?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
    disconnect?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
    delete?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
    connect?: ClientDelayWhereUniqueInput | ClientDelayWhereUniqueInput[]
    update?: ClientDelayUpdateWithWhereUniqueWithoutProjectInput | ClientDelayUpdateWithWhereUniqueWithoutProjectInput[]
    updateMany?: ClientDelayUpdateManyWithWhereWithoutProjectInput | ClientDelayUpdateManyWithWhereWithoutProjectInput[]
    deleteMany?: ClientDelayScalarWhereInput | ClientDelayScalarWhereInput[]
  }

  export type TimeEntryUncheckedUpdateManyWithoutProjectNestedInput = {
    create?: XOR<TimeEntryCreateWithoutProjectInput, TimeEntryUncheckedCreateWithoutProjectInput> | TimeEntryCreateWithoutProjectInput[] | TimeEntryUncheckedCreateWithoutProjectInput[]
    connectOrCreate?: TimeEntryCreateOrConnectWithoutProjectInput | TimeEntryCreateOrConnectWithoutProjectInput[]
    upsert?: TimeEntryUpsertWithWhereUniqueWithoutProjectInput | TimeEntryUpsertWithWhereUniqueWithoutProjectInput[]
    createMany?: TimeEntryCreateManyProjectInputEnvelope
    set?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    disconnect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    delete?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    connect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    update?: TimeEntryUpdateWithWhereUniqueWithoutProjectInput | TimeEntryUpdateWithWhereUniqueWithoutProjectInput[]
    updateMany?: TimeEntryUpdateManyWithWhereWithoutProjectInput | TimeEntryUpdateManyWithWhereWithoutProjectInput[]
    deleteMany?: TimeEntryScalarWhereInput | TimeEntryScalarWhereInput[]
  }

  export type ProjectCreateNestedOneWithoutClientDelaysInput = {
    create?: XOR<ProjectCreateWithoutClientDelaysInput, ProjectUncheckedCreateWithoutClientDelaysInput>
    connectOrCreate?: ProjectCreateOrConnectWithoutClientDelaysInput
    connect?: ProjectWhereUniqueInput
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ProjectUpdateOneRequiredWithoutClientDelaysNestedInput = {
    create?: XOR<ProjectCreateWithoutClientDelaysInput, ProjectUncheckedCreateWithoutClientDelaysInput>
    connectOrCreate?: ProjectCreateOrConnectWithoutClientDelaysInput
    upsert?: ProjectUpsertWithoutClientDelaysInput
    connect?: ProjectWhereUniqueInput
    update?: XOR<XOR<ProjectUpdateToOneWithWhereWithoutClientDelaysInput, ProjectUpdateWithoutClientDelaysInput>, ProjectUncheckedUpdateWithoutClientDelaysInput>
  }

  export type TimeEntryCreateNestedManyWithoutOperatorInput = {
    create?: XOR<TimeEntryCreateWithoutOperatorInput, TimeEntryUncheckedCreateWithoutOperatorInput> | TimeEntryCreateWithoutOperatorInput[] | TimeEntryUncheckedCreateWithoutOperatorInput[]
    connectOrCreate?: TimeEntryCreateOrConnectWithoutOperatorInput | TimeEntryCreateOrConnectWithoutOperatorInput[]
    createMany?: TimeEntryCreateManyOperatorInputEnvelope
    connect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
  }

  export type TimeEntryUncheckedCreateNestedManyWithoutOperatorInput = {
    create?: XOR<TimeEntryCreateWithoutOperatorInput, TimeEntryUncheckedCreateWithoutOperatorInput> | TimeEntryCreateWithoutOperatorInput[] | TimeEntryUncheckedCreateWithoutOperatorInput[]
    connectOrCreate?: TimeEntryCreateOrConnectWithoutOperatorInput | TimeEntryCreateOrConnectWithoutOperatorInput[]
    createMany?: TimeEntryCreateManyOperatorInputEnvelope
    connect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
  }

  export type TimeEntryUpdateManyWithoutOperatorNestedInput = {
    create?: XOR<TimeEntryCreateWithoutOperatorInput, TimeEntryUncheckedCreateWithoutOperatorInput> | TimeEntryCreateWithoutOperatorInput[] | TimeEntryUncheckedCreateWithoutOperatorInput[]
    connectOrCreate?: TimeEntryCreateOrConnectWithoutOperatorInput | TimeEntryCreateOrConnectWithoutOperatorInput[]
    upsert?: TimeEntryUpsertWithWhereUniqueWithoutOperatorInput | TimeEntryUpsertWithWhereUniqueWithoutOperatorInput[]
    createMany?: TimeEntryCreateManyOperatorInputEnvelope
    set?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    disconnect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    delete?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    connect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    update?: TimeEntryUpdateWithWhereUniqueWithoutOperatorInput | TimeEntryUpdateWithWhereUniqueWithoutOperatorInput[]
    updateMany?: TimeEntryUpdateManyWithWhereWithoutOperatorInput | TimeEntryUpdateManyWithWhereWithoutOperatorInput[]
    deleteMany?: TimeEntryScalarWhereInput | TimeEntryScalarWhereInput[]
  }

  export type TimeEntryUncheckedUpdateManyWithoutOperatorNestedInput = {
    create?: XOR<TimeEntryCreateWithoutOperatorInput, TimeEntryUncheckedCreateWithoutOperatorInput> | TimeEntryCreateWithoutOperatorInput[] | TimeEntryUncheckedCreateWithoutOperatorInput[]
    connectOrCreate?: TimeEntryCreateOrConnectWithoutOperatorInput | TimeEntryCreateOrConnectWithoutOperatorInput[]
    upsert?: TimeEntryUpsertWithWhereUniqueWithoutOperatorInput | TimeEntryUpsertWithWhereUniqueWithoutOperatorInput[]
    createMany?: TimeEntryCreateManyOperatorInputEnvelope
    set?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    disconnect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    delete?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    connect?: TimeEntryWhereUniqueInput | TimeEntryWhereUniqueInput[]
    update?: TimeEntryUpdateWithWhereUniqueWithoutOperatorInput | TimeEntryUpdateWithWhereUniqueWithoutOperatorInput[]
    updateMany?: TimeEntryUpdateManyWithWhereWithoutOperatorInput | TimeEntryUpdateManyWithWhereWithoutOperatorInput[]
    deleteMany?: TimeEntryScalarWhereInput | TimeEntryScalarWhereInput[]
  }

  export type ProjectCreateNestedManyWithoutClientInput = {
    create?: XOR<ProjectCreateWithoutClientInput, ProjectUncheckedCreateWithoutClientInput> | ProjectCreateWithoutClientInput[] | ProjectUncheckedCreateWithoutClientInput[]
    connectOrCreate?: ProjectCreateOrConnectWithoutClientInput | ProjectCreateOrConnectWithoutClientInput[]
    createMany?: ProjectCreateManyClientInputEnvelope
    connect?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
  }

  export type ProjectUncheckedCreateNestedManyWithoutClientInput = {
    create?: XOR<ProjectCreateWithoutClientInput, ProjectUncheckedCreateWithoutClientInput> | ProjectCreateWithoutClientInput[] | ProjectUncheckedCreateWithoutClientInput[]
    connectOrCreate?: ProjectCreateOrConnectWithoutClientInput | ProjectCreateOrConnectWithoutClientInput[]
    createMany?: ProjectCreateManyClientInputEnvelope
    connect?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
  }

  export type ProjectUpdateManyWithoutClientNestedInput = {
    create?: XOR<ProjectCreateWithoutClientInput, ProjectUncheckedCreateWithoutClientInput> | ProjectCreateWithoutClientInput[] | ProjectUncheckedCreateWithoutClientInput[]
    connectOrCreate?: ProjectCreateOrConnectWithoutClientInput | ProjectCreateOrConnectWithoutClientInput[]
    upsert?: ProjectUpsertWithWhereUniqueWithoutClientInput | ProjectUpsertWithWhereUniqueWithoutClientInput[]
    createMany?: ProjectCreateManyClientInputEnvelope
    set?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
    disconnect?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
    delete?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
    connect?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
    update?: ProjectUpdateWithWhereUniqueWithoutClientInput | ProjectUpdateWithWhereUniqueWithoutClientInput[]
    updateMany?: ProjectUpdateManyWithWhereWithoutClientInput | ProjectUpdateManyWithWhereWithoutClientInput[]
    deleteMany?: ProjectScalarWhereInput | ProjectScalarWhereInput[]
  }

  export type ProjectUncheckedUpdateManyWithoutClientNestedInput = {
    create?: XOR<ProjectCreateWithoutClientInput, ProjectUncheckedCreateWithoutClientInput> | ProjectCreateWithoutClientInput[] | ProjectUncheckedCreateWithoutClientInput[]
    connectOrCreate?: ProjectCreateOrConnectWithoutClientInput | ProjectCreateOrConnectWithoutClientInput[]
    upsert?: ProjectUpsertWithWhereUniqueWithoutClientInput | ProjectUpsertWithWhereUniqueWithoutClientInput[]
    createMany?: ProjectCreateManyClientInputEnvelope
    set?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
    disconnect?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
    delete?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
    connect?: ProjectWhereUniqueInput | ProjectWhereUniqueInput[]
    update?: ProjectUpdateWithWhereUniqueWithoutClientInput | ProjectUpdateWithWhereUniqueWithoutClientInput[]
    updateMany?: ProjectUpdateManyWithWhereWithoutClientInput | ProjectUpdateManyWithWhereWithoutClientInput[]
    deleteMany?: ProjectScalarWhereInput | ProjectScalarWhereInput[]
  }

  export type OperatorCreateNestedOneWithoutTimeEntriesInput = {
    create?: XOR<OperatorCreateWithoutTimeEntriesInput, OperatorUncheckedCreateWithoutTimeEntriesInput>
    connectOrCreate?: OperatorCreateOrConnectWithoutTimeEntriesInput
    connect?: OperatorWhereUniqueInput
  }

  export type ProjectCreateNestedOneWithoutTimeEntriesInput = {
    create?: XOR<ProjectCreateWithoutTimeEntriesInput, ProjectUncheckedCreateWithoutTimeEntriesInput>
    connectOrCreate?: ProjectCreateOrConnectWithoutTimeEntriesInput
    connect?: ProjectWhereUniqueInput
  }

  export type OperatorUpdateOneRequiredWithoutTimeEntriesNestedInput = {
    create?: XOR<OperatorCreateWithoutTimeEntriesInput, OperatorUncheckedCreateWithoutTimeEntriesInput>
    connectOrCreate?: OperatorCreateOrConnectWithoutTimeEntriesInput
    upsert?: OperatorUpsertWithoutTimeEntriesInput
    connect?: OperatorWhereUniqueInput
    update?: XOR<XOR<OperatorUpdateToOneWithWhereWithoutTimeEntriesInput, OperatorUpdateWithoutTimeEntriesInput>, OperatorUncheckedUpdateWithoutTimeEntriesInput>
  }

  export type ProjectUpdateOneRequiredWithoutTimeEntriesNestedInput = {
    create?: XOR<ProjectCreateWithoutTimeEntriesInput, ProjectUncheckedCreateWithoutTimeEntriesInput>
    connectOrCreate?: ProjectCreateOrConnectWithoutTimeEntriesInput
    upsert?: ProjectUpsertWithoutTimeEntriesInput
    connect?: ProjectWhereUniqueInput
    update?: XOR<XOR<ProjectUpdateToOneWithWhereWithoutTimeEntriesInput, ProjectUpdateWithoutTimeEntriesInput>, ProjectUncheckedUpdateWithoutTimeEntriesInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }
  export type NestedJsonFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type HdbClientCreateWithoutProjectsInput = {
    id?: string
    nombre: string
    email?: string | null
    telefono?: string | null
    direccion?: string | null
    activo?: boolean
    createdAt?: Date | string
  }

  export type HdbClientUncheckedCreateWithoutProjectsInput = {
    id?: string
    nombre: string
    email?: string | null
    telefono?: string | null
    direccion?: string | null
    activo?: boolean
    createdAt?: Date | string
  }

  export type HdbClientCreateOrConnectWithoutProjectsInput = {
    where: HdbClientWhereUniqueInput
    create: XOR<HdbClientCreateWithoutProjectsInput, HdbClientUncheckedCreateWithoutProjectsInput>
  }

  export type ClientDelayCreateWithoutProjectInput = {
    id?: string
    fecha: string
    hora: string
    operador: string
    area: string
    motivo: string
    duracion: number
    createdAt?: Date | string
  }

  export type ClientDelayUncheckedCreateWithoutProjectInput = {
    id?: string
    fecha: string
    hora: string
    operador: string
    area: string
    motivo: string
    duracion: number
    createdAt?: Date | string
  }

  export type ClientDelayCreateOrConnectWithoutProjectInput = {
    where: ClientDelayWhereUniqueInput
    create: XOR<ClientDelayCreateWithoutProjectInput, ClientDelayUncheckedCreateWithoutProjectInput>
  }

  export type ClientDelayCreateManyProjectInputEnvelope = {
    data: ClientDelayCreateManyProjectInput | ClientDelayCreateManyProjectInput[]
    skipDuplicates?: boolean
  }

  export type TimeEntryCreateWithoutProjectInput = {
    id?: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    operator: OperatorCreateNestedOneWithoutTimeEntriesInput
  }

  export type TimeEntryUncheckedCreateWithoutProjectInput = {
    id?: string
    operatorId: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TimeEntryCreateOrConnectWithoutProjectInput = {
    where: TimeEntryWhereUniqueInput
    create: XOR<TimeEntryCreateWithoutProjectInput, TimeEntryUncheckedCreateWithoutProjectInput>
  }

  export type TimeEntryCreateManyProjectInputEnvelope = {
    data: TimeEntryCreateManyProjectInput | TimeEntryCreateManyProjectInput[]
    skipDuplicates?: boolean
  }

  export type HdbClientUpsertWithoutProjectsInput = {
    update: XOR<HdbClientUpdateWithoutProjectsInput, HdbClientUncheckedUpdateWithoutProjectsInput>
    create: XOR<HdbClientCreateWithoutProjectsInput, HdbClientUncheckedCreateWithoutProjectsInput>
    where?: HdbClientWhereInput
  }

  export type HdbClientUpdateToOneWithWhereWithoutProjectsInput = {
    where?: HdbClientWhereInput
    data: XOR<HdbClientUpdateWithoutProjectsInput, HdbClientUncheckedUpdateWithoutProjectsInput>
  }

  export type HdbClientUpdateWithoutProjectsInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    telefono?: NullableStringFieldUpdateOperationsInput | string | null
    direccion?: NullableStringFieldUpdateOperationsInput | string | null
    activo?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HdbClientUncheckedUpdateWithoutProjectsInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    telefono?: NullableStringFieldUpdateOperationsInput | string | null
    direccion?: NullableStringFieldUpdateOperationsInput | string | null
    activo?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClientDelayUpsertWithWhereUniqueWithoutProjectInput = {
    where: ClientDelayWhereUniqueInput
    update: XOR<ClientDelayUpdateWithoutProjectInput, ClientDelayUncheckedUpdateWithoutProjectInput>
    create: XOR<ClientDelayCreateWithoutProjectInput, ClientDelayUncheckedCreateWithoutProjectInput>
  }

  export type ClientDelayUpdateWithWhereUniqueWithoutProjectInput = {
    where: ClientDelayWhereUniqueInput
    data: XOR<ClientDelayUpdateWithoutProjectInput, ClientDelayUncheckedUpdateWithoutProjectInput>
  }

  export type ClientDelayUpdateManyWithWhereWithoutProjectInput = {
    where: ClientDelayScalarWhereInput
    data: XOR<ClientDelayUpdateManyMutationInput, ClientDelayUncheckedUpdateManyWithoutProjectInput>
  }

  export type ClientDelayScalarWhereInput = {
    AND?: ClientDelayScalarWhereInput | ClientDelayScalarWhereInput[]
    OR?: ClientDelayScalarWhereInput[]
    NOT?: ClientDelayScalarWhereInput | ClientDelayScalarWhereInput[]
    id?: StringFilter<"ClientDelay"> | string
    projectId?: StringFilter<"ClientDelay"> | string
    fecha?: StringFilter<"ClientDelay"> | string
    hora?: StringFilter<"ClientDelay"> | string
    operador?: StringFilter<"ClientDelay"> | string
    area?: StringFilter<"ClientDelay"> | string
    motivo?: StringFilter<"ClientDelay"> | string
    duracion?: FloatFilter<"ClientDelay"> | number
    createdAt?: DateTimeFilter<"ClientDelay"> | Date | string
  }

  export type TimeEntryUpsertWithWhereUniqueWithoutProjectInput = {
    where: TimeEntryWhereUniqueInput
    update: XOR<TimeEntryUpdateWithoutProjectInput, TimeEntryUncheckedUpdateWithoutProjectInput>
    create: XOR<TimeEntryCreateWithoutProjectInput, TimeEntryUncheckedCreateWithoutProjectInput>
  }

  export type TimeEntryUpdateWithWhereUniqueWithoutProjectInput = {
    where: TimeEntryWhereUniqueInput
    data: XOR<TimeEntryUpdateWithoutProjectInput, TimeEntryUncheckedUpdateWithoutProjectInput>
  }

  export type TimeEntryUpdateManyWithWhereWithoutProjectInput = {
    where: TimeEntryScalarWhereInput
    data: XOR<TimeEntryUpdateManyMutationInput, TimeEntryUncheckedUpdateManyWithoutProjectInput>
  }

  export type TimeEntryScalarWhereInput = {
    AND?: TimeEntryScalarWhereInput | TimeEntryScalarWhereInput[]
    OR?: TimeEntryScalarWhereInput[]
    NOT?: TimeEntryScalarWhereInput | TimeEntryScalarWhereInput[]
    id?: StringFilter<"TimeEntry"> | string
    operatorId?: StringFilter<"TimeEntry"> | string
    projectId?: StringFilter<"TimeEntry"> | string
    fecha?: StringFilter<"TimeEntry"> | string
    horaIngreso?: StringNullableFilter<"TimeEntry"> | string | null
    horaEgreso?: StringNullableFilter<"TimeEntry"> | string | null
    horasTrabajadas?: FloatFilter<"TimeEntry"> | number
    estadoConfirmado?: BoolFilter<"TimeEntry"> | boolean
    confirmadoPorSupervisor?: StringNullableFilter<"TimeEntry"> | string | null
    createdAt?: DateTimeFilter<"TimeEntry"> | Date | string
    updatedAt?: DateTimeFilter<"TimeEntry"> | Date | string
  }

  export type ProjectCreateWithoutClientDelaysInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
    client?: HdbClientCreateNestedOneWithoutProjectsInput
    timeEntries?: TimeEntryCreateNestedManyWithoutProjectInput
  }

  export type ProjectUncheckedCreateWithoutClientDelaysInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    clientId?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
    timeEntries?: TimeEntryUncheckedCreateNestedManyWithoutProjectInput
  }

  export type ProjectCreateOrConnectWithoutClientDelaysInput = {
    where: ProjectWhereUniqueInput
    create: XOR<ProjectCreateWithoutClientDelaysInput, ProjectUncheckedCreateWithoutClientDelaysInput>
  }

  export type ProjectUpsertWithoutClientDelaysInput = {
    update: XOR<ProjectUpdateWithoutClientDelaysInput, ProjectUncheckedUpdateWithoutClientDelaysInput>
    create: XOR<ProjectCreateWithoutClientDelaysInput, ProjectUncheckedCreateWithoutClientDelaysInput>
    where?: ProjectWhereInput
  }

  export type ProjectUpdateToOneWithWhereWithoutClientDelaysInput = {
    where?: ProjectWhereInput
    data: XOR<ProjectUpdateWithoutClientDelaysInput, ProjectUncheckedUpdateWithoutClientDelaysInput>
  }

  export type ProjectUpdateWithoutClientDelaysInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    client?: HdbClientUpdateOneWithoutProjectsNestedInput
    timeEntries?: TimeEntryUpdateManyWithoutProjectNestedInput
  }

  export type ProjectUncheckedUpdateWithoutClientDelaysInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    clientId?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    timeEntries?: TimeEntryUncheckedUpdateManyWithoutProjectNestedInput
  }

  export type TimeEntryCreateWithoutOperatorInput = {
    id?: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    project: ProjectCreateNestedOneWithoutTimeEntriesInput
  }

  export type TimeEntryUncheckedCreateWithoutOperatorInput = {
    id?: string
    projectId: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TimeEntryCreateOrConnectWithoutOperatorInput = {
    where: TimeEntryWhereUniqueInput
    create: XOR<TimeEntryCreateWithoutOperatorInput, TimeEntryUncheckedCreateWithoutOperatorInput>
  }

  export type TimeEntryCreateManyOperatorInputEnvelope = {
    data: TimeEntryCreateManyOperatorInput | TimeEntryCreateManyOperatorInput[]
    skipDuplicates?: boolean
  }

  export type TimeEntryUpsertWithWhereUniqueWithoutOperatorInput = {
    where: TimeEntryWhereUniqueInput
    update: XOR<TimeEntryUpdateWithoutOperatorInput, TimeEntryUncheckedUpdateWithoutOperatorInput>
    create: XOR<TimeEntryCreateWithoutOperatorInput, TimeEntryUncheckedCreateWithoutOperatorInput>
  }

  export type TimeEntryUpdateWithWhereUniqueWithoutOperatorInput = {
    where: TimeEntryWhereUniqueInput
    data: XOR<TimeEntryUpdateWithoutOperatorInput, TimeEntryUncheckedUpdateWithoutOperatorInput>
  }

  export type TimeEntryUpdateManyWithWhereWithoutOperatorInput = {
    where: TimeEntryScalarWhereInput
    data: XOR<TimeEntryUpdateManyMutationInput, TimeEntryUncheckedUpdateManyWithoutOperatorInput>
  }

  export type ProjectCreateWithoutClientInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
    clientDelays?: ClientDelayCreateNestedManyWithoutProjectInput
    timeEntries?: TimeEntryCreateNestedManyWithoutProjectInput
  }

  export type ProjectUncheckedCreateWithoutClientInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
    clientDelays?: ClientDelayUncheckedCreateNestedManyWithoutProjectInput
    timeEntries?: TimeEntryUncheckedCreateNestedManyWithoutProjectInput
  }

  export type ProjectCreateOrConnectWithoutClientInput = {
    where: ProjectWhereUniqueInput
    create: XOR<ProjectCreateWithoutClientInput, ProjectUncheckedCreateWithoutClientInput>
  }

  export type ProjectCreateManyClientInputEnvelope = {
    data: ProjectCreateManyClientInput | ProjectCreateManyClientInput[]
    skipDuplicates?: boolean
  }

  export type ProjectUpsertWithWhereUniqueWithoutClientInput = {
    where: ProjectWhereUniqueInput
    update: XOR<ProjectUpdateWithoutClientInput, ProjectUncheckedUpdateWithoutClientInput>
    create: XOR<ProjectCreateWithoutClientInput, ProjectUncheckedCreateWithoutClientInput>
  }

  export type ProjectUpdateWithWhereUniqueWithoutClientInput = {
    where: ProjectWhereUniqueInput
    data: XOR<ProjectUpdateWithoutClientInput, ProjectUncheckedUpdateWithoutClientInput>
  }

  export type ProjectUpdateManyWithWhereWithoutClientInput = {
    where: ProjectScalarWhereInput
    data: XOR<ProjectUpdateManyMutationInput, ProjectUncheckedUpdateManyWithoutClientInput>
  }

  export type ProjectScalarWhereInput = {
    AND?: ProjectScalarWhereInput | ProjectScalarWhereInput[]
    OR?: ProjectScalarWhereInput[]
    NOT?: ProjectScalarWhereInput | ProjectScalarWhereInput[]
    id?: StringFilter<"Project"> | string
    nombre?: StringFilter<"Project"> | string
    activo?: BoolFilter<"Project"> | boolean
    observaciones?: StringNullableFilter<"Project"> | string | null
    horasEstimadas?: IntFilter<"Project"> | number
    horasConsumidas?: IntFilter<"Project"> | number
    cliente?: StringNullableFilter<"Project"> | string | null
    clientId?: StringNullableFilter<"Project"> | string | null
    responsable?: StringNullableFilter<"Project"> | string | null
    estado?: StringFilter<"Project"> | string
    fechaInicio?: StringNullableFilter<"Project"> | string | null
    fechaFin?: StringNullableFilter<"Project"> | string | null
    createdAt?: DateTimeFilter<"Project"> | Date | string
  }

  export type OperatorCreateWithoutTimeEntriesInput = {
    id?: string
    nombreCompleto: string
    activo?: boolean
    etiquetas: JsonNullValueInput | InputJsonValue
    pin?: string
    role?: string
    createdAt?: Date | string
  }

  export type OperatorUncheckedCreateWithoutTimeEntriesInput = {
    id?: string
    nombreCompleto: string
    activo?: boolean
    etiquetas: JsonNullValueInput | InputJsonValue
    pin?: string
    role?: string
    createdAt?: Date | string
  }

  export type OperatorCreateOrConnectWithoutTimeEntriesInput = {
    where: OperatorWhereUniqueInput
    create: XOR<OperatorCreateWithoutTimeEntriesInput, OperatorUncheckedCreateWithoutTimeEntriesInput>
  }

  export type ProjectCreateWithoutTimeEntriesInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
    client?: HdbClientCreateNestedOneWithoutProjectsInput
    clientDelays?: ClientDelayCreateNestedManyWithoutProjectInput
  }

  export type ProjectUncheckedCreateWithoutTimeEntriesInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    clientId?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
    clientDelays?: ClientDelayUncheckedCreateNestedManyWithoutProjectInput
  }

  export type ProjectCreateOrConnectWithoutTimeEntriesInput = {
    where: ProjectWhereUniqueInput
    create: XOR<ProjectCreateWithoutTimeEntriesInput, ProjectUncheckedCreateWithoutTimeEntriesInput>
  }

  export type OperatorUpsertWithoutTimeEntriesInput = {
    update: XOR<OperatorUpdateWithoutTimeEntriesInput, OperatorUncheckedUpdateWithoutTimeEntriesInput>
    create: XOR<OperatorCreateWithoutTimeEntriesInput, OperatorUncheckedCreateWithoutTimeEntriesInput>
    where?: OperatorWhereInput
  }

  export type OperatorUpdateToOneWithWhereWithoutTimeEntriesInput = {
    where?: OperatorWhereInput
    data: XOR<OperatorUpdateWithoutTimeEntriesInput, OperatorUncheckedUpdateWithoutTimeEntriesInput>
  }

  export type OperatorUpdateWithoutTimeEntriesInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    etiquetas?: JsonNullValueInput | InputJsonValue
    pin?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OperatorUncheckedUpdateWithoutTimeEntriesInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombreCompleto?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    etiquetas?: JsonNullValueInput | InputJsonValue
    pin?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProjectUpsertWithoutTimeEntriesInput = {
    update: XOR<ProjectUpdateWithoutTimeEntriesInput, ProjectUncheckedUpdateWithoutTimeEntriesInput>
    create: XOR<ProjectCreateWithoutTimeEntriesInput, ProjectUncheckedCreateWithoutTimeEntriesInput>
    where?: ProjectWhereInput
  }

  export type ProjectUpdateToOneWithWhereWithoutTimeEntriesInput = {
    where?: ProjectWhereInput
    data: XOR<ProjectUpdateWithoutTimeEntriesInput, ProjectUncheckedUpdateWithoutTimeEntriesInput>
  }

  export type ProjectUpdateWithoutTimeEntriesInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    client?: HdbClientUpdateOneWithoutProjectsNestedInput
    clientDelays?: ClientDelayUpdateManyWithoutProjectNestedInput
  }

  export type ProjectUncheckedUpdateWithoutTimeEntriesInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    clientId?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clientDelays?: ClientDelayUncheckedUpdateManyWithoutProjectNestedInput
  }

  export type ClientDelayCreateManyProjectInput = {
    id?: string
    fecha: string
    hora: string
    operador: string
    area: string
    motivo: string
    duracion: number
    createdAt?: Date | string
  }

  export type TimeEntryCreateManyProjectInput = {
    id?: string
    operatorId: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ClientDelayUpdateWithoutProjectInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    hora?: StringFieldUpdateOperationsInput | string
    operador?: StringFieldUpdateOperationsInput | string
    area?: StringFieldUpdateOperationsInput | string
    motivo?: StringFieldUpdateOperationsInput | string
    duracion?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClientDelayUncheckedUpdateWithoutProjectInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    hora?: StringFieldUpdateOperationsInput | string
    operador?: StringFieldUpdateOperationsInput | string
    area?: StringFieldUpdateOperationsInput | string
    motivo?: StringFieldUpdateOperationsInput | string
    duracion?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClientDelayUncheckedUpdateManyWithoutProjectInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    hora?: StringFieldUpdateOperationsInput | string
    operador?: StringFieldUpdateOperationsInput | string
    area?: StringFieldUpdateOperationsInput | string
    motivo?: StringFieldUpdateOperationsInput | string
    duracion?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TimeEntryUpdateWithoutProjectInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    operator?: OperatorUpdateOneRequiredWithoutTimeEntriesNestedInput
  }

  export type TimeEntryUncheckedUpdateWithoutProjectInput = {
    id?: StringFieldUpdateOperationsInput | string
    operatorId?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TimeEntryUncheckedUpdateManyWithoutProjectInput = {
    id?: StringFieldUpdateOperationsInput | string
    operatorId?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TimeEntryCreateManyOperatorInput = {
    id?: string
    projectId: string
    fecha: string
    horaIngreso?: string | null
    horaEgreso?: string | null
    horasTrabajadas?: number
    estadoConfirmado?: boolean
    confirmadoPorSupervisor?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TimeEntryUpdateWithoutOperatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    project?: ProjectUpdateOneRequiredWithoutTimeEntriesNestedInput
  }

  export type TimeEntryUncheckedUpdateWithoutOperatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    projectId?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TimeEntryUncheckedUpdateManyWithoutOperatorInput = {
    id?: StringFieldUpdateOperationsInput | string
    projectId?: StringFieldUpdateOperationsInput | string
    fecha?: StringFieldUpdateOperationsInput | string
    horaIngreso?: NullableStringFieldUpdateOperationsInput | string | null
    horaEgreso?: NullableStringFieldUpdateOperationsInput | string | null
    horasTrabajadas?: FloatFieldUpdateOperationsInput | number
    estadoConfirmado?: BoolFieldUpdateOperationsInput | boolean
    confirmadoPorSupervisor?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProjectCreateManyClientInput = {
    id?: string
    nombre: string
    activo?: boolean
    observaciones?: string | null
    horasEstimadas?: number
    horasConsumidas?: number
    cliente?: string | null
    responsable?: string | null
    estado?: string
    fechaInicio?: string | null
    fechaFin?: string | null
    createdAt?: Date | string
  }

  export type ProjectUpdateWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clientDelays?: ClientDelayUpdateManyWithoutProjectNestedInput
    timeEntries?: TimeEntryUpdateManyWithoutProjectNestedInput
  }

  export type ProjectUncheckedUpdateWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clientDelays?: ClientDelayUncheckedUpdateManyWithoutProjectNestedInput
    timeEntries?: TimeEntryUncheckedUpdateManyWithoutProjectNestedInput
  }

  export type ProjectUncheckedUpdateManyWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    nombre?: StringFieldUpdateOperationsInput | string
    activo?: BoolFieldUpdateOperationsInput | boolean
    observaciones?: NullableStringFieldUpdateOperationsInput | string | null
    horasEstimadas?: IntFieldUpdateOperationsInput | number
    horasConsumidas?: IntFieldUpdateOperationsInput | number
    cliente?: NullableStringFieldUpdateOperationsInput | string | null
    responsable?: NullableStringFieldUpdateOperationsInput | string | null
    estado?: StringFieldUpdateOperationsInput | string
    fechaInicio?: NullableStringFieldUpdateOperationsInput | string | null
    fechaFin?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use ProjectCountOutputTypeDefaultArgs instead
     */
    export type ProjectCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ProjectCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use OperatorCountOutputTypeDefaultArgs instead
     */
    export type OperatorCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = OperatorCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use HdbClientCountOutputTypeDefaultArgs instead
     */
    export type HdbClientCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = HdbClientCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ProjectDefaultArgs instead
     */
    export type ProjectArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ProjectDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ClientDelayDefaultArgs instead
     */
    export type ClientDelayArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ClientDelayDefaultArgs<ExtArgs>
    /**
     * @deprecated Use OperatorDefaultArgs instead
     */
    export type OperatorArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = OperatorDefaultArgs<ExtArgs>
    /**
     * @deprecated Use FavoriteBlockDefaultArgs instead
     */
    export type FavoriteBlockArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = FavoriteBlockDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PlanningDefaultArgs instead
     */
    export type PlanningArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PlanningDefaultArgs<ExtArgs>
    /**
     * @deprecated Use HdbClientDefaultArgs instead
     */
    export type HdbClientArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = HdbClientDefaultArgs<ExtArgs>
    /**
     * @deprecated Use TimeEntryDefaultArgs instead
     */
    export type TimeEntryArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = TimeEntryDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}