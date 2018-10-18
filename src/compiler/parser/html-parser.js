/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// Regular Expressions for parsing tags and attributes
/**
 *  /^\s*  ([^\s"'<>\/=]+)  (  ?:\s*(=)\s*  (?:  "([^"]*)"+  |  '([^']*)'+  |([^\s"'=<>`]+)  ))?/
 *  ([^\s"'<>\/=]+)  表示属性名
 *  ?:\s*(=)\s*      表示等号
 *  "([^"]*)"+       表示 "some-class" 类型属性值
 *  '([^']*)'+       表示 'some-class' 类型属性值
 *  |([^\s"'=<>`]+)  表示 some-class 类型属性值
 */
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
// 用来检测给定的标签名字是不是纯文本标签（包括：script、style、textarea）
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}


// 下面decodingMap、encodedAttr、encodedAttrWithNewLines三个变量是用来完成对 html 实体进行解码的。
const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
// 检测给的标签中是否包含pre或者textarea
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
// 用来检测是否应该忽略元素内容的第一个换行符
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

// decodeAttr 函数是用来解码 html 实体的
function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

// html是需要被parse
export function parseHTML (html, options) {
  /**
   * 定义一些常量和变量，
   * 在while循环中处理html字符流的时候每当遇到一个 非一元标签，
   * 都会将该开始标签push进入这个stack数组当中（入栈），
   * 可以用于检测html字符串中是否缺少闭合标签。
   */
  const stack = []
  const expectHTML = options.expectHTML
  // no为始终返回false的函数
  // 检测一个标签是否为一元标签
  const isUnaryTag = options.isUnaryTag || no
  // 检测一个标签是否可以是省略闭合标签的非一元标签
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  // 标识着当前字符流的读入位置
  let index = 0
  /**
   * last：剩余存储还未parse的html字符串
   * lastTag：始终存储着位于stack栈顶的元素
   */
  let last, lastTag
  // 开启一个 while 循环，循环结束的条件是 html 为空，即 html 被 parse 完毕
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      // 确保即将 parse 的内容不是在纯文本标签里 (script,style,textarea)
      let textEnd = html.indexOf('<')

      // 如果textEnd === 0 ，说明当前html为<div>111</div>，这种类型。
      if (textEnd === 0) {
        // Comment:
        // 如果是注释节点
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          // 如果能够匹配到 '-->' 说明是注释节点
          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              // 将字符串首页的 '<--' 和 '-->' 截取掉
              options.comment(html.substring(4, commentEnd))
            }
            /**
             * 将已经 parser 的字符串剔除，
             * 例如有以下html字符串：html = <!-- a comment --!><div></div>，
             * 执行了该函数后 html = <div></div>
             */
            advance(commentEnd + 3)
            // 执行continue跳出此次while循环，进入下个while循环
            continue
          }
        }

        // 有可能是条件注释节点，和上面的注释节点处理情况相同
        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype的情况
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        // 结束标签
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        // 开始标签
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
        advance(textEnd)
      }

      if (textEnd < 0) {
        text = html
        html = ''
      }

      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      // 即将 parse 的内容是在纯文本标签里 (script,style,textarea)
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }
    // 将整个字符串作为文本对待
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance (n) {
    index += n
    html = html.substring(n)
  }

  // parseStartTag 函数用来 parse 开始标签
  function parseStartTag () {
    const start = html.match(startTagOpen)
    if (start) {
      /**
       * 举个例子：<div></div>，
       * match后的start数组为 ['<div', 'div']
       */
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      /**
       * 没有匹配到开始标签的结束部分，
       * 并且匹配到了开始标签中的属性，
       * 这个时候循环体将被执行，
       * 直到遇到开始标签的结束部分为止。
       */
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  // handleStartTag 函数用来处理 parseStartTag 的结果
  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    // expectHTML 是 parser 选项，是一个布尔值
    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // unary 是一个布尔值，当它为真时代表着标签是一元标签，否则是二元标签
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)

    // 这个 for 循环的作用是：格式化 match.attrs 数组，并将格式化后的数据存储到常量 attrs 中
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
    }

    // 如果开始标签是非一元标签，则将该开始标签的信息入栈，即 push 到 stack 数组中，并将 lastTag 的值设置为该标签名
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  // parseEndTag 函数用来 parse 结束标签
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
