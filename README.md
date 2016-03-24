# gulp-static-tools

starting a list of desired tasks to have on the gulp static tools. Comments and feedaback, very welcome.

### Dev Tasks

- BrowserSync
- Sass
- Image Dev
- JS Dev
- Nunjucks
  - Render Data from JSON **[build]** - done
  - Render HTML from Template and Data (Vinyl) **[build]** - done
  - journaling files **[maybe build]**
  - selective rendering of files in fake vinyl stream based on changes in the data file (dependent on journaling above) **[build]**
  - Custom Filters
    - slug **[build]** - done
  - preprocess (d3) data / various json preprocessing scripts for certain reusable components **[build]**


### Deploy Tasks

- Image Optimization
- css minification
- JS Lint, concatenation and minification
- Deploy Command (GH-pages or AWS)
- compression of dist folder where applicable

### Other Tasks
- update version into an html/etc template automatically from package.json **[build]** - done for styleguide
- changelog via cli when updating or patching a version if using npm **[build]**
- test script(s) / travis integration **[semi build]**

### Other Important Workflow Details
- setup a .gitignore and .gitconfig




