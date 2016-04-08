# source

Source contains the entire folder structure of the pre-build site.

## IMPORTANT NOTE

Paths used in templates and js in `source` are **based on the production folder structure in `public`**, not the folder structure here.  The folder structure of `source` is simplified for organizational and readability purposes, and is restructured to a more nested production-optimal structure in `public` by gulp on build.  All template output html will be flattened into the base directory of `public` and can use paths like `img/xyz.jpg` or `js/scripts.js` to reference assets.