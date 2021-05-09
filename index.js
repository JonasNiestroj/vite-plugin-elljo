const fileRegex = /\.jo$/
const path = require('path')
const chalk = require('chalk')
const highlight = require('./highlight')

const getDigits = (number) => {
  return Math.log(number) * Math.LOG10E + 1 | 0;
}

function jo() {
  return {
    name: 'jo-loader',
    transform(source, id) {
      if (fileRegex.test(id)) {
        
        return new Promise((resolve, reject) => {
          var spawn = require('child_process').spawn
          const child = spawn(path.join(__dirname, '../', '.bin/jo'), ['--service']);
          var command = `compile ${source.replace(/\r?\n|\r/g, "\\n")}`
          child.stdin.write(Buffer.from(command, 'utf8'));
          child.stdout.on('data', function (data) {
            let output = JSON.parse(data.toString())
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
              resolve({
                code: output.output,
                map: output.sourcemap
              })
            }
            
          });
          child.stdin.end();
        });
      }
    }
  }
}

module.exports = jo
jo['default'] = jo