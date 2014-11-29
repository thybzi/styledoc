#!/usr/bin/env node

var styledoc = require('./../../styledoc');

styledoc.showcaseFile('css/main.css', {
    page_title: 'StyleDoc :: Example 1 :: FS/NodeJS + PhantomJS showcase',
    preview_padding: [ 0, 0, 4 ], // padding-bottom: 4px (button shadow maximum size)
    output_dir: 'showcase/nodejs_phantomjs/',
    use_phantomjs: true
});
