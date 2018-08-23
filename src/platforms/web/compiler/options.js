/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  /**
   * modules 实际上就是一个数组，
   * 数组有三个元素 klass、style 以及 model，
   * 并且这三个元素来自于当前目录下的三个相应名称的 js 文件
   */
  modules,
  /**
   * 同样类似于 modules 输出，
   * 只不过 directives 最终输出的不是数组，
   * 而是一个对象，这个对象包含三个属性 model、text 以及 html，
   * 这三个属性同样来自于当前目录下的三个文件：model.js、text.js 以及 html.js 文件
   */
  directives,
  /**
   * 它是一个函数，
   * 其作用是通过给定的标签名字检查标签是否是 'pre' 标签
   */
  isPreTag,
  /**
   * isUnaryTag 是一个通过 makeMap 生成的函数
   * 该函数的作用是检测给定的标签是否是一元标签。
   */
  isUnaryTag,
  /**
   * mustUseProp它是一个函数
   * 其作用是用来检测一个属性在标签中是否要使用 props 进行绑定
   */
  mustUseProp,
  /**
   * canBeLeftOpenTag它也是一个函数
   * 该函数也是一个使用 makeMap 生成的函数，
   * 它的作用是检测一个标签是否是那些虽然不是一元标签，
   * 但却可以自己补全并闭合的标签。
   */
  canBeLeftOpenTag,
  /**
   * isReservedTag它是一个函数
   * 其作用是检查给定的标签是否是保留的标签。
   */
  isReservedTag,
  /**
   * getTagNamespace它也是一个函数
   * 其作用是获取元素(标签)的命名空间
   */
  getTagNamespace,
  /**
   * 它的值是通过以 modules 为参数调用 genStaticKeys 函数的返回值得到的。
   * 其中 modules 就是 baseOptions 的第二个属性，
   * 而 genStaticKeys 来自于 src/shared/util.js 文件。
   * 其作用是根据编译器选项的 modules 选项生成一个静态键字符串。
   */
  staticKeys: genStaticKeys(modules)
}
