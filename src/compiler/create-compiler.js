/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      /**
       * 以baseOptions为原型创建一个新对象，
       * 其中baseOptions为src\platforms\web\compiler.options.js中定义的。
       */
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []
      /**
       * finalOptions 上添加了 warn 函数，
       * 该函数接收两个参数：1、msg 错误或提示的信息，2、tip 用来标示 msg 是错误还是提示。
       * 可以猜想的到 warn 选项主要用在编译过程中的错误和提示收集，
       * 如果收集的信息是错误信息就将错误信息添加到前面定义的 errors 数组里，
       * 如果是提示信息就将其添加到 tips 数组里。
       */
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }

      /**
       * 这段代码检查 options 是否存在，
       * 这里的 options 就是使用编译器编译模板时传递的选项参数，
       * 或者可以简单理解为调用 compileToFunctions 函数时传递的选项参数。
       * 其实我们可以把 baseOptions 理解为编译器的默认选项或者基本选项，
       * 而 options 是用来提供定制能力的扩展选项。
       * 而上面这段代码的作用，就是将 options 对象混合到 finalOptions 中.
       */
      if (options) {
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      const compiled = baseCompile(template, finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        errors.push.apply(errors, detectErrors(compiled.ast))
      }
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
