/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    /**
     * compile函数主要有三个作用：
     * 1、生成最终编译器选项 finalOptions
     * 2、对错误的收集
     * 3、调用 baseCompile 编译模板
     */
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
      /**
       * 这里将将模板字符串template转换为渲染函数字符串，
       * 其中的baseCompile是在src/compiler/index.js中调用createCompilerCreator传入的参数
       */
      const compiled = baseCompile(template, finalOptions)
      /**
       * compiled 是 baseCompile 对模板的编译结果，
       * 该结果中包含了模板编译后的抽象语法树(AST)，
       * 可以通过 compiled.ast 访问该语法树。
       */
      /**
       * 这段代码的作用是用来通过抽象语法树来检查模板中是否存在错误表达式的，
       * 通过 detectErrors 函数实现，
       * 将 compiled.ast 作为参数传递给 detectErrors 函数，
       * 该函数最终返回一个数组，
       * 该数组中包含了所有错误的收集，
       * 最终通过这句代码将错误添加到 errors 数组中。
       */
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
