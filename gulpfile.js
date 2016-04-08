var
gulp            = require('gulp'),
util            = require('gulp-util'),
sass            = require('gulp-sass'),
shell           = require('gulp-shell'),
data            = require('gulp-data'),
nunjucksRender  = require('gulp-nunjucks-render'),
plumber         = require('gulp-plumber'),
yaml            = require('gulp-yaml'),
flatten         = require('gulp-flatten'),
intercept       = require('gulp-intercept'),
bs              = require('browser-sync').create(),
minimist        = require('minimist'),
File            = require('vinyl'),
es              = require('event-stream'),
fs              = require('fs'),
packagejson     = require('./package.json')
;

// define options & configuration ///////////////////////////////////

// get arguments from command line
var argv = minimist(process.argv.slice(2));

// command line options (usage: gulp --optionname)
var cliOptions = {
  verbose   : false || argv.verbose,
  nosync    : false || argv.nosync
};

// gulpfile options
var options = {
  path: './source/templates/', // base path to templates
  dataPath: './source/data/', // base path to datasets
  ext: '.html', // extension to use for templates
  dataExt: '.json', // extension to use for data
  manageEnv: nunjucksEnv, // function to manage nunjucks environment
  libraryPath: 'node_modules/govlab-styleguide/dist/', // path to installed sass/js library distro folder
  defaultData: './source/data/default.json' // default dataset to use if no automatically generated template is found
};

// initialize browsersync
gulp.task('bs', function() {
  if (!cliOptions.nosync) {
    bs.init({
      server: 'public',
      open: false
    });
  }
});

// define custom functions ///////////////////////////////////

// converts string t to a slug (eg 'Some Text Here' becomes 'some-text-here')
function slugify(t) {
  return t ? t.toString().toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^\w\-]+/g, '')
  .replace(/\-\-+/g, '-')
  .replace(/^-+/, '')
  .replace(/-+$/, '')
  : false ;
}

// set up nunjucks environment
function nunjucksEnv(env) {
  env.addFilter('slug', slugify);
}

// object to compile all the generated datasets into a composite set
// for injection into nunjucks using gulp-data
var generatedData = {};

// generate a stream of one or more vinyl files from a json data source
// containing the parent template specified by templatePath
// which can then be piped into nunjucks to create output with data scoped to the datum
function generateVinyl(basePath, dataPath, fPrefix, fSuffix, dSuffix) {
  var files = [], r, r2, f, baseTemplate, baseName, _data
  base = fs.readdirSync(basePath),
  dataDir = fs.readdirSync(dataPath)
  ;
  // stupid code courtesy of node doesnt support default parameters as of v5
  fPrefix = fPrefix === undefined ? '' : fPrefix;
  fSuffix = fSuffix === undefined ? options.ext : fSuffix;
  dSuffix = dSuffix === undefined ? options.dataExt : dSuffix;

  for (var template in base) {
    // match a filename starting with '__' and ending with the file suffix
    r = new RegExp('^__[^.]*\\' + fSuffix + '$');
    if (r.test(base[template])) {
      // read the file in as our base template
      baseTemplate = fs.readFileSync(basePath + base[template]);

      // strip __ and extension to get base naming convention
      baseName = base[template]
      .replace(/^__/, '')
      .replace(new RegExp('\\' + fSuffix + '$'), '')
      ;

      // create a new dir for the output if it doesn't already exist
      // based on naming convention

      if (!fs.existsSync(basePath + baseName)){
        fs.mkdirSync(basePath + baseName);
      }

      // look for a data file matching the naming convention
      r2 = new RegExp(baseName + '\\' + dSuffix + '$');
      for (var dataset in dataDir) {
        if (r2.test(dataDir[dataset])) {

          // convert file data to object
          _data = require(dataPath + dataDir[dataset]).data;

          // add data to composite set
          generatedData[baseName] = _data;

          // create a new vinyl file for each datum in _data and push to files
          // using directory based on naming convention and base template as content
          for (var d in _data) {
            f = new File({
              base: basePath,
              path: basePath + baseName + '/' + fPrefix + _data[d].id + '-' + slugify(_data[d].title) + fSuffix,
              contents: baseTemplate
            });
            files.push(f);
          }
        }
      }
    }
  }

  // convert files array to stream and return
  return require('stream').Readable({ objectMode: true }).wrap(es.readArray(files));
}

// define gulp tasks ///////////////////////////////////

gulp.task('sass', function() {
  return gulp.src('source/sass/styles.scss')
  .pipe(sass().on('error', sass.logError))
  .pipe(gulp.dest('public/css'))
  .pipe(cliOptions.nosync ? bs.stream() : util.noop());
});

gulp.task('libCss', function() {
  return gulp.src(options.libraryPath + 'css/**/*')
  .pipe(plumber())
  .pipe(gulp.dest('source/css/lib'))
  .pipe(gulp.dest('public/css/lib'));
});

gulp.task('libJs', function() {
  return gulp.src(options.libraryPath + 'js/**/*')
  .pipe(plumber())
  .pipe(gulp.dest('source/js/lib'));
});

gulp.task('js', ['libJs'], function() {
  return gulp.src('source/js/**/*')
  .pipe(plumber())
  .pipe(gulp.dest('public/js'))
  .pipe(cliOptions.nosync ? bs.stream() : util.noop());
});

gulp.task('img', function() {
  return gulp.src('source/img/**/*')
  .pipe(plumber())
  .pipe(gulp.dest('public/img'))
  .pipe(cliOptions.nosync ? bs.stream() : util.noop());
});

gulp.task('yaml', function () {
  return gulp.src('source/data/**/*.+(yaml|yml)')
  .pipe(yaml())
  .pipe(gulp.dest('source/data'));
});

gulp.task('json', ['yaml'], function () {
  return gulp.src('source/data/**/*.json')
  .pipe(intercept(function(file){
    var o = JSON.parse(file.contents.toString()),
    b = {};
    b['data'] = o;
    if (cliOptions.verbose) {
      util.log(util.colors.magenta('Converting yaml ' + file.path), 'to json as', util.colors.blue(JSON.stringify(b)));
    }
    file.contents = new Buffer ( JSON.stringify(b) );
    return file;
  }))
  .pipe(gulp.dest('source/data'));
});

gulp.task('generateTemplates', function() {
  return generateVinyl(options.path, options.dataPath)
  .pipe(gulp.dest(options.path))
});

gulp.task('nunjucks', ['generateTemplates'], function() {
  return gulp.src( options.path + '**/*' + options.ext )
  .pipe(plumber())
  .pipe(data(function(file) {
    // check if the file is an auto generated file
    // filename must contain a unique id which must also be present in the data as 'id'
    for (var datasetName in generatedData) {
      for (var i in generatedData[datasetName]) {
        if (file.path.indexOf(generatedData[datasetName][i].id) >= 0) {
          if (cliOptions.verbose) {
            util.log(util.colors.green('Found Generated Template ' + file.path), ': using', JSON.stringify(generatedData[datasetName][i]));
          }
          // return data matching id in dataset datasetName
          return generatedData[datasetName][i];
        }
      }
    }
    // if no id is found, return a default dataset
    return require(options.defaultData).data;
  }))
  .pipe(nunjucksRender(options))
  .pipe(flatten())
  .pipe(gulp.dest('public'));
});

var buildTasks = ['sass', 'js', 'img', 'nunjucks', 'libCss'];
gulp.task('build', buildTasks, function () {
  util.log('Running build tasks: ', buildTasks, gutil.colors.magenta('****'));
})

gulp.task('deploy', ['build'], shell.task([
  'git subtree push --prefix public origin gh-pages'
  ])
);

gulp.task('default', ['bs', 'build'], function (){
  gulp.watch('source/sass/**/*.scss', ['sass']);
  gulp.watch('source/templates/**/*.html', ['nunjucks']);
  gulp.watch('source/img/**/*', ['img']);
  gulp.watch('source/js/**/*', ['js']);
});
