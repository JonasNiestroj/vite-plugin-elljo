const fileRegex = /\.jo$/
const path = require('path')
const chalk = require('chalk')
const highlight = require('./highlight')

const getDigits = (number) => {
  return Math.log(number) * Math.LOG10E + 1 | 0;
}

const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gm
const langRegex = /<style lang="(.*)">/gm
const cssCache = {}

const parseId = (id) => {
  const split = id.split("?")
  return { file: split[0], query: split[1] }
}

const replaceInString = (text, start, end, newText) => {
  return text.substring(0, start) + newText + text.substring(end)
}

function jo() {
  return {
    name: 'jo-loader',
    load(id) {
      const parsedId = parseId(id)
      if (parsedId.query && parsedId.file.endsWith(".jo")) {
        const searchParams = new URLSearchParams(parsedId.query)
        if (searchParams.get("type") === 'style' && cssCache[parsedId.file]) {
          return cssCache[parsedId.file]
        }
      }
    },
    transform(source, id) {
      if (fileRegex.test(id)) {
        return new Promise(async (resolve, reject) => {
          let match = null;
          while (match = styleRegex.exec(source)) {
            const lang = langRegex.exec(match[0])
            if (lang && lang[1]) {
              if (lang[1] === "postcss") {
                const postcss = require('postcss')
                const postcssrc = require('postcss-load-config')
                const postcssConfig = postcssrc.sync()
                const indexOfInSource = source.indexOf(match[1])
                const result = await postcss(postcssConfig.plugins).process(match[1], { from: undefined })
                source = replaceInString(source, indexOfInSource, indexOfInSource + match[1].length, result.css)
              }
            }
          }
          var spawn = require('child_process').spawn
          const child = spawn(path.join(__dirname, '../', '.bin/elljo-compiler'), ['--service']);
          var command = `compile ${id.split("/").pop()} ${source.replace(/\r?\n|\r/g, "\\n")}`
          var buffer = Buffer.from(command, 'utf8')
          let outputJson = ""
          child.stdin.write(buffer);
          child.stdout.on('data', function (data) {
            outputJson += data.toString()
          });
          child.on('close', () => {
            let output = JSON.parse(outputJson)
            // If the output is an array it is an array of errors
            if (Array.isArray(output)) {
              reject({message: "Parsing of " + id + " failed"})
              setTimeout(() => {
                output.forEach(error => {
                  console.log("\n")
                  console.log(chalk`{bgRed.black   Error  } {white in file ${id} on line ${error.line}}`)
                  console.log("")
                  console.log(error.message)
                  let errorSource = []
                  let sourceByLine = source.split("\n")
                  const maxDigits = getDigits(error.line + 2)
                  for (let i = Math.max(error.line - 2, 1); i <= error.line + 2; i++) {
                    let output = ""
                    const digits = getDigits(i)
                    if (digits < maxDigits) {
                      output += " "
                    }
                    errorSource.push(chalk.gray(output + i + " | ") + sourceByLine[i - 1])
                    if (i === error.line) {
                      let errorUnderline = ""
                      for (let j = 0; j < maxDigits; j++) {
                        errorUnderline += " "
                      }
                      errorUnderline += chalk.gray(" | ")
                      for (let j = 0; j < error.endColumn; j++) {
                        if (j >= error.startColumn) {
                          errorUnderline += chalk.red("^")
                        } else {
                          errorUnderline += " "
                        }
                      }
                      errorSource.push(errorUnderline)
                    }
                  }
                  console.log(highlight(errorSource.join("\n")))
                })
              }, 100)
            } else {
              let code = output.output
              if (output.css) {
                code += `;import "${id}?type=style&lang.css"`
                cssCache[id] = output.css
              }
              resolve({
                code: code,
                map: output.sourcemap
              })
            }

          })
          child.stdin.end();
        });
      }
    }
  }
}

module.exports = jo
jo['default'] = jo