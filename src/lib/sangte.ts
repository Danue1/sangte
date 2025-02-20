import produce, { Draft, isDraftable } from 'immer'

type Fn = () => void
type UpdateFn<T> = (state: T) => T
export type ActionRecord<T> = Record<string, (...params: any[]) => T | Draft<T> | void>
type Actions<T, A extends ActionRecord<T>> = (prevState: Draft<T> | T) => A
interface SangteConfig {
  key?: string
  global?: boolean
}

export type SangteInstance<T, A extends ActionRecord<T>> = {
  initialState: T
  getState: () => T
  setState: (update: UpdateFn<T> | T) => void
  subscribe: (callback: Fn) => Fn
  actions: A | null
  reset: () => void
}
export type Sangte<T, A extends ActionRecord<T> = any> = {
  (): SangteInstance<T, A>
  config: SangteConfig
}

export type UnwrapSangteValue<T> = T extends Sangte<infer U> ? U : never

export type UnwrapSangteAction<T> = T extends Sangte<any, infer U> ? U : never

function isUpdateFn<T>(value: any): value is UpdateFn<T> {
  return typeof value === 'function'
}

function createSangte<T, A extends ActionRecord<T>>(
  initialState: T,
  createActions?: Actions<T, A>
): SangteInstance<T, A> {
  let state = initialState
  const callbacks = new Set<Fn>()

  function getState() {
    return state
  }

  function setState(update: UpdateFn<T> | T) {
    if (isUpdateFn<T>(update)) {
      state = update(state)
    } else {
      state = update
    }
    callbacks.forEach((cb) => cb())
  }

  function subscribe(callback: Fn): Fn {
    callbacks.add(callback)
    return () => callbacks.delete(callback)
  }

  function reset() {
    setState(initialState)
  }

  const actions = (() => {
    if (!createActions) return null
    const record = createActions(initialState)
    const keys = Object.keys(record) as (keyof A)[]
    keys.forEach((key) => {
      record[key] = ((...params: any[]) => {
        setState((prevState) => {
          if (!isDraftable(prevState)) {
            const action = createActions(prevState)[key]
            const next = action(...params)
            return next as any
          }
          const produced = produce(prevState, (draft) => {
            const action = createActions(draft)[key]
            const result = action(...params)
            if (result !== undefined) {
              return result as Draft<T>
            }
          })
          return produced
        })
      }) as A[keyof A]
    })
    return record
  })()

  return {
    initialState,
    getState,
    setState,
    subscribe,
    actions,
    reset,
  }
}

export function sangte<T, A extends ActionRecord<T>>(
  initialState: T,
  config?: SangteConfig
): Sangte<T, A>
export function sangte<T, A extends ActionRecord<T>>(
  initialState: T,
  actions: Actions<T, A>,
  config?: SangteConfig
): Sangte<T, A>
export function sangte<T, A extends ActionRecord<T>>(
  initialState: T,
  actions?: Actions<T, A> | SangteConfig,
  config?: SangteConfig
) {
  const hasActions = typeof actions === 'function'
  const sangte = function () {
    if (hasActions) {
      return createSangte<T, A>(initialState, actions)
    }
    return createSangte(initialState)
  }
  if (hasActions) {
    sangte.config = config || {}
  } else {
    sangte.config = actions || {}
  }

  return sangte
}
