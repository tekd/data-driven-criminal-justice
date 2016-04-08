var
gulp            = require('gulp'),
util            = require('gulp-util'),
sass            = require('gulp-sass'),
shell           = require('gulp-shell'),
data            = require('gulp-data'),
nunjucksRender  = require('gulp-nunjucks-render'),
bs              = require('browser-sync').create(),
plumber         = require('gulp-plumber'),
colors          = require('colors'),
minimist        = require('minimist'),
File            = require('vinyl'),
es              = require('event-stream'),
fs              = require('fs'),
defaultData     = require('./source/data/default.json').data, // default data to use if no automatically generated template is found
packagejson     = require('./package.json')
;

// define options & configuration ///////////////////////////////////

var argv = minimist(process.argv.slice(2));

var cliOptions = {
  verbose   : false || argv.verbose,
  nosync    : false || argv.nosync
};

var options = {
  path: './source/templates/', // base path to templates
  ext: '.html', // extension to use for templates
  generatedPath: '', // relative path to use for generated templates within base path
  generatedTemplate: './source/templates/_template.html', // source template to use for generated templates
  manageEnv: nunjucksEnv // function to manage nunjucks environment
  libraryPath: 'node_modules/govlab-styleguide/dist/' // path to installed sass/js library distro folder
};

gulp.task('bs', function() {
  if (!nosync) {
    bs.init({
      server: 'public',
      open: false
    });
  }
});

// define custom functions ///////////////////////////////////

function slugify(t) {
  return t ? t.toString().toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^\w\-]+/g, '')
  .replace(/\-\-+/g, '-')
  .replace(/^-+/, '')
  .replace(/-+$/, '')
  : false ;
}

function nunjucksEnv(env) {
  env.addFilter('slug', slugify);
}

function generateVinyl(_data, basePath, templatePath, filePrefix, fileSuffix) {
  var templatefile = fs.readFileSync(templatePath);
  var files = [];

  if (filePrefix === undefined) {
    filePrefix = '';
  }

  if (fileSuffix === undefined) {
    fileSuffix = options.ext;
  }

  for (d in _data) {
    var f = new File({
      cwd: '.',
      base: basePath,
      path: basePath + filePrefix + _data[d].id + '-' + slugify(_data[d].title) + fileSuffix,
      contents: templatefile
    });
    files.push(f);
  }

  return require('stream').Readable({ objectMode: true }).wrap(es.readArray(files));
}

// define gulp tasks ///////////////////////////////////

gulp.task('sass', function() {
  return gulp.src('source/sass/styles.scss')
  .pipe(sass().on('error', sass.logError))
  .pipe(gulp.dest('public/css'))
  .pipe(nosync ? bs.stream() : util.noop());
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
  .pipe(nosync ? bs.stream() : util.noop());
});

gulp.task('img', function() {
  return gulp.src('source/img/**/*')
  .pipe(plumber())
  .pipe(gulp.dest('public/img'))
  .pipe(nosync ? bs.stream() : util.noop());
});

gulp.task('generateTemplates', function() {
  return generateVinyl(generatedData, options.path + options.generatedPath, options.generatedTemplate)
  .pipe(gulp.dest(options.path + options.generatedPath))
});

gulp.task('nunjucks', ['generateTemplates'], function() {
  return gulp.src( options.path + '**/*' + options.ext )
  .pipe(plumber())
  .pipe(data(function(file) {
    for (var i in generatedData) {
      // check if the file is an auto generated file
      // filename must contain a unique id field which must also be present in the data
      if (file.path.indexOf(generatedData[i].id) >= 0) {
        if (cliOptions.verbose) {
          console.log('Found Generated Template',  file.path, ': using ', JSON.stringify(generatedData[i]).green);
        }
        // use the data matching id of the file
        return generatedData[i];
      }
    }
    // if no id is found, return a default dataset
    return defaultData;
  }))
  .pipe(nunjucksRender(options))
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
