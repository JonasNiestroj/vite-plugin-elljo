const { JSDOM } = require("jsdom")
const prismjs = require('prismjs/prism')
const theme = require('./theme')

const themeKeys = Object.keys(theme.token)

const loadLanguages = require('prismjs/components/');
loadLanguages();

const getTokenColor = (tokens) => {

  let themeToken = null

  for(token of tokens) {
    if (themeKeys.includes(token)) {
      themeToken = theme.token[token]
      break   
    }
  }

  return themeToken ? themeToken : (content) => {return content}
}

const parseElements = (elements) => {
  let source = ""

  elements.forEach(element => {
    if (element.hasChildNodes()) {
      tokenColor = getTokenColor(element.classList);
      source += tokenColor(parseElements(element.childNodes))
    } else {
      source += element.textContent;
    }
  })

  return source
}

const highlight = (source) => {
  const prismSource = prismjs.highlight(source, Prism.languages['html'], 'html')
  const dom = JSDOM.fragment(prismSource)
  const highlightedSource = parseElements(dom.childNodes)

  return highlightedSource
}

module.exports = highlight