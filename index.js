const path = require('path');
const chalk = require('chalk');
const highlight = require('./highlight');

const getDigits = (number) => {
  return (Math.log(number) * Math.LOG10E + 1) | 0;
};

const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gm;
const langRegex = /<style lang="(.*)">/gm;
const cssCache = {};

const parseId = (id) => {
  const split = id.split('?');
  return { file: split[0], query: split[1] };
};

const replaceInString = (text, start, end, newText) => {
  return text.substring(0, start) + newText + text.substring(end);
};

const handlePostCss = async (source) => {
  let match = null;

  while ((match = styleRegex.exec(source))) {
    const lang = langRegex.exec(match[0]);

    if (lang && lang[1]) {
      // Check if there is a lang="postcss"
      if (lang[1] === 'postcss') {
        const postcss = require('postcss');
        const postcssrc = require('postcss-load-config');
        const postcssConfig = postcssrc.sync();

        const indexOfInSource = source.indexOf(match[1]);
        const result = await postcss(postcssConfig.plugins).process(match[1], {
          from: undefined,
        });

        source = replaceInString(
          source,
          indexOfInSource,
          indexOfInSource + match[1].length,
          result.css
        );
      }
    }
  }
  return source;
};

const compileEllJoCode = (source, parsedId) => {
  return new Promise((resolve, reject) => {
    var spawn = require('child_process').spawn;
    const child = spawn(
      path.join(__dirname, '../', '.bin/elljo-compiler'),
      ['--service'],
      { stdio: ['pipe', 'pipe', 'inherit'] }
    );
    var command = `compile ${parsedId.file.split('/').pop()} ${source}`;

    var buffer = Buffer.from(command, 'utf8');

    child.stdin.setEncoding('utf-8');
    child.stdin.write(buffer);
    child.stdin.end();

    child.stdout.on('data', function (data) {
      resolve(JSON.parse(data.toString()));
    });
  });
};

const handleErrors = (source, parsedId, output) => {
  output.forEach((error) => {
    console.log('\n');
    console.log(
      chalk`{bgRed.black   Error  } {white in file ${parsedId.file} on line ${error.line}}`
    );
    console.log('');
    console.log(error.message);
    let errorSource = [];
    let sourceByLine = source.split('\n');
    const maxDigits = getDigits(error.line + 2);
    for (let i = Math.max(error.line - 2, 1); i <= error.line + 2; i++) {
      let output = '';
      const digits = getDigits(i);
      if (digits < maxDigits) {
        output += ' ';
      }
      errorSource.push(chalk.gray(output + i + ' | ') + sourceByLine[i - 1]);
      if (i === error.line) {
        let errorUnderline = '';
        for (let j = 0; j < maxDigits; j++) {
          errorUnderline += ' ';
        }
        errorUnderline += chalk.gray(' | ');

        for (let j = 1; j <= error.endColumn; j++) {
          if (j >= error.startColumn) {
            errorUnderline += chalk.red('^');
          } else {
            errorUnderline += ' ';
          }
        }
        errorSource.push(errorUnderline);
      }
    }
    console.log(highlight(errorSource.join('\n')));
  });
};

const handleEllJoTransform = (source, parsedId) => {
  return new Promise(async (resolve, reject) => {
    source = await handlePostCss(source);

    const output = await compileEllJoCode(source, parsedId);

    if (!output) {
      resolve(null);
    }

    // If the output is an array it is an array of errors
    if (Array.isArray(output)) {
      reject({ message: 'Parsing of ' + parsedId.file + ' failed' });
      setTimeout(() => {
        handleErrors(source, parsedId, output);
      }, 100);
    } else {
      let code = output.output;

      if (output.css) {
        // Add import statement to load css
        code += `;import "${parsedId.file}?type=style&lang.css"`;
        cssCache[parsedId.file] = output.css;
      }
      resolve({
        code: code,
        map: output.sourcemap,
      });
    }
  });
};

function elljo() {
  return {
    name: 'elljo-loader',
    load(id) {
      const parsedId = parseId(id);

      // Lets check if it is a elljo file and if there is a query
      if (parsedId.query && parsedId.file.endsWith('.jo')) {
        const searchParams = new URLSearchParams(parsedId.query);

        // If its trying to load styles and the current file is in our cache
        if (searchParams.get('type') === 'style' && cssCache[parsedId.file]) {
          return cssCache[parsedId.file];
        }
      }
    },
    transform(source, id) {
      const parsedId = parseId(id);

      if (parsedId.file.endsWith('.jo') && !parsedId.query) {
        return handleEllJoTransform(source, parsedId);
      }
    },
  };
}

module.exports = elljo;
elljo['default'] = elljo;
