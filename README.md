# gulp-easy-rev
this gulp plugin is a modification to [gulp-rev](https://github.com/sindresorhus/gulp-rev), 
so user will not need to worry about [vinyl](https://github.com/gulpjs/vinyl) `path/base`.

```javascript
gulp.task('rev', function() {
  return gulp.src([
    'public/css/style.css',
    'public/js/script.js',
    'third-party/js/shim.js',
    'third-party/css/vendor.css'
  ])
  .pipe(rev({
    omit: ['public', 'third-party']
  }))
  .pipe(gulp.dest('public/build'))
  .pipe(rev.manifest())
  .pipe(gulp.dest('public/build'));
});
```

#### omit:
`string` or `array`


The final dir structure will look like this:

```
public/
  build/
    css/
      style-3984f73734.css
      vendor-3cf181f61a.css
    js/
      shim-3cf181f61a.js
      script-6735d6856c.js
    rev-manifest.json
```

it is also possible that you merge the output of rev-manifest.json in two tasks, for example:

```javascript
gulp.task('rev1', function() {
  return gulp.src([
    'public/css/style.css',
    'public/js/script.js',
  ])
  .pipe(rev({
    omit: 'public'
  }))
  .pipe(gulp.dest('public/build'))
  .pipe(rev.manifest({
    manifestPath: 'public/build/rev-manifest.json',
    merge: true,
  }))
  .pipe(gulp.dest('public/build'));
});

gulp.task('rev', function() {
  return gulp.src([
    'third-party/js/shim.js',
    'third-party/css/vendor.css'
  ])
  .pipe(rev({
    omit: 'third-party'
  }))
  .pipe(gulp.dest('public/build'))
  .pipe(rev.manifest({
    manifestPath: 'public/build/rev-manifest.json',
    merge: true,
  }))
  .pipe(gulp.dest('public/build'));
});
```

When `merge` is `true`, you must specify `manifestPath`, otherwise the plugin will not know the path of your rev-manifest.json
file and also it will overwrite the rev-manifest.json instead of merge it.
