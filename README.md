StyleDoc: showcase you styles
==============
Parser and showcase generator for JavaDoc-like comments in CSS, LESS, SASS etc.  
Written on Javascript, available for both browser and NodeJS usage.  
Inspired with concept idea of https://github.com/Joony/styledoc/


Syntax example
---------------
```css
/**
 * Buttons
 * All different kind of buttons used on website pages
 * @base     button     Normal button
 * @modifier .large     Large button
 * @modifier :disabled  Button unable to be pressed
 * @modifier .large:disabled Large button disabled
 * @example  <button>Button text</button>
 */
button {
    /* styles here */
} 
```

Besides normal `/**` docblocks, StyleDoc also supports `/*!` docblock format, which [can be used in Stylus](http://learnboost.github.io/stylus/docs/comments.html#multi-line-buffered) CSS preprocessor.


What does the tool do?
---------------
StyleDoc tool **parses CSS file**, extracting styledoc-blocks (like the one above) and **creating showcase page** based on them.

This page contains full list of documented elements and their variations, illustrated with live preview and markup example.


Live examples
---------------

* **CSS source:** **[main.css](https://github.com/thybzi/styledoc/tree/master/examples/ex1/css/main.css)**    
  Built from following LESS files: 
  [button.less](https://github.com/thybzi/styledoc/tree/master/examples/ex1/less/button.less),
  [checkbox.less](https://github.com/thybzi/styledoc/tree/master/examples/ex1/less/checkbox.less),
  [__mixins.less](https://github.com/thybzi/styledoc/tree/master/examples/ex1/less/__mixins.less),
  [__build.less](https://github.com/thybzi/styledoc/tree/master/examples/ex1/less/__build.less)
* **Showcase pages** generated in different ways:    
  **[Browser](http://thybzi.github.io/styledoc/examples/ex1/showcase/browser/)** 
  ([source](https://github.com/thybzi/styledoc/tree/master/examples/ex1/showcase/browser/index.html)),
  **[NodeJS](http://thybzi.github.io/styledoc/examples/ex1/showcase/nodejs/)** 
  ([source](https://github.com/thybzi/styledoc/tree/master/examples/ex1/showcase_nodejs.js)),
  **[NodeJS + PhantomJS](http://thybzi.github.io/styledoc/examples/ex1/showcase/nodejs_phantomjs/)** 
  ([source](https://github.com/thybzi/styledoc/tree/master/examples/ex1/showcase_nodejs_phantomjs.js))


All examples sources are available in *[examples](https://github.com/thybzi/styledoc/tree/master/examples/)* directory of project repository.

More examples coming soon!


Quick start
---------------
First of all, **you need a CSS file with some styledoc-blocks** inside.

StyleDoc tool will create a showcase page based on such CSS file.  
It can be created in two ways:

1. *[Browser way](#httpbrowser-way)* (HTTP)
2. *[NodeJS way](#filesystemnodejs-way)* (filesystem)



### HTTP/browser way
In this mode, the tool generates showcase page dynamically inside a HTML file opened with browser.

All required files are loaded via HTTP requests (Ajax).

1. [Download the archive](https://github.com/thybzi/styledoc/archive/master.zip) and unpack it (you only need `styledoc.js` and `templates` directory). You can also use [Bower installation](#bower-installation).    
  Using `js/styledoc/` directory is recommended (otherwise you'll need to [reconfigure templates path](#set-templates-directory)).    
2. Download [jQuery](http://jquery.com/download/) *1.11.1+ or 2.1.1+* ([why these versions?](#why-new-version-of-jquery-is-required))   
  (needed only for separate showcase HTML file, no need to change version on other pages of your website)
3. Download [mustache.js](https://github.com/janl/mustache.js)
4. Create a new HTML file with some basic markup, JS library links, and `styledoc.showcaseFile()` call. Something as simple as that:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My styles demo</title>
    <meta charset="utf-8">
    <script src="js/jquery-1.11.1.js"></script>
    <script src="js/mustache.js"></script>
    <script src="js/styledoc/styledoc.js"></script>
</head>
<body>

<script>
    styledoc.showcaseFile('css/mystyle.css');
</script>

</body>
</html>

```
After that, **just open the file with your browser** (use `http://` or `https://`, not `file:///`) and have fun!

CSS file path can be provided as an URL, or a path relative to current location.

Note that loading CSS file via cross-domain URL file may require a [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing) header   
(e.g. `Access-Control-Allow-Origin: *`).

For advanced configuration, see *[Configuration](#configuration)* section.

#### Bower installation
StyleDoc is also available in [Bower](http://bower.io/):
```
bower install styledoc
```


### Filesystem/NodeJS way
In this mode, the tool generates showcase HTML files within the filesystem.

Browser renders these files faster, because they are "hardcoded" and not formed dynamically.  

Also, if you have [PhantomJS](http://phantomjs.org/) installed, you can minimize iframe loading lag and prevent page height changing ([more details](#phantomjs-advantage) follow).

Required files are loaded via either filesystem or HTTP requests.

#### Installing
Assuming you already have [NodeJS](http://nodejs.org/) installed.
```
npm install styledoc
```

#### Basic usage
```javascript
var styledoc = require('styledoc');
styledoc.showcaseFile('css/mystyle.css', {
    page_title: 'My presentation title'
});
``` 
CSS file path can be provided as an URL, or a path relative to current location.

The above code will create your presentation files in `showcase/` directory (relative to the current directory).

You can change the output directory to any other relative path (trailing slash is optional).
```javascript
var styledoc = require('styledoc');
styledoc.showcaseFile('css/mystyle.css', {
    page_title: 'My presentation title',
    output_dir: 'my/presentation/subdir/'
});
``` 


#### PhantomJS advantage
**If you have [PhantomJS](http://phantomjs.org/) installed** in your system, you can use it to improve showcase generation.

It will pre-measure the height of each preview iframe item when generating them to **achieve maximum rendering speed** for showcase page (and also to avoid some possible client bugs).

To involve PhantomJS for showcase generation, **just add one more option** (`use_phantomjs: true`):
```javascript
var styledoc = require('styledoc');
styledoc.showcaseFile('css/mystyle.css', {
    page_title: 'My presentation title',
    use_phantomjs: true
});
```

#### Advanced configuration
See *[Configuration](#configuration)* section.

#### Windows users
StyleDoc requires JSDom module when in NodeJS mode.

JSDom installation could be a bit tricky on Windows (see [corresponding section](#jsdom-dependency) for more details).  
If you are not enough lucky or patient, just use StyleDoc in HTTP/browser way.

Note that there are also [some PhantomJS usage issues](#phantomjs-optional-dependency) on Windows, but they don't prevent installing or running StyleDoc in non-PhantomJS-mode.

 


Supported tags list
---------------
* **@section**: Section number and title within showcase file    
  *Example:* `@section 2.3 Buttons`    
  Sections are sorted by section number    
  If section title is omitted, block title or `@base` title is used instead
* **@base**: Base CSS selector and title    
  *Example:* `@base button Normal button`    
  Base selector can contain element name, class or whatever.    
  All modifiers and states are applied to this kind of element.    
* **@modifier**: CSS selector and title for modifier    
  *Example:* `@modifier .large Large sized button`    
  A selector that modifies `@base` selector by adding class(es) or/and ID or/and any other CSS modification that can by applied by creating or altering some HTML attribute(s).    
  Any number of modifiers can exist within the same section.
* **@state**: CSS selector and title for state    
  *Example:* `@state .active Active state of the button`    
  *Alias:* `@pseudo`    
  A special kind of modifier that doesn't represent any valuable variation of element, but only some special state (like `:checked` or `.active`).    
  All modifiers are sequentially applied within each showcase subsection, instead of creating a separate subsection.    
  Any number of states can exist within the same section.    
  Just like common modifiers, can only represent CSS modification applicable with HTML attributes.
* **@example**: HTML code representing the usage of element    
  *Example:* `@example <button>Sample text</button>`    
  *Alias:* `@markup`    
  Should contain HTML markup for CSS selector determined in `@base`.    
  Gets altered by all modifiers and states documented, creating code for HTML markup example (and also for live preview, if not overridden by `@presentation`).    
  Can be multiline (relative indents are respected). Can begin from the next line after the tag.
* **@presentation**: HTML code for the live preview of element (if it should differ from `@example` for some reason)    
  *Alias:* `@preview`    
  *Example:* `@presentation <div><button>Sample text</button></div>` 
  Can be multiline (relative indents are respected). Can begin from the next line after the tag.    
* **@author**: Name, email, etc. of the code block author    
  *Example:* `@author John Smith <jsmith@gmail.com>`    
  Multiple instances are allowed within the same section.
* **@version**: Version of code block (if you need to specify it by some reason)    
  *Example:* `@version 1.4`
* **@since**: Code version element exists since    
  *Example:* `@since 1.1`
* **@deprecated**: Beginning code version and/or reasons for element deprecating    
  *Example:* `@deprecated 1.2 Use .action-button instead`    
  Either version or description can be omitted.
* **@see**: Some reference to be mentioned    
  *Example:* `@see http://stackoverflow.com/a/428032`    
  Multiple instances are allowed within the same section.
* **@todo**: Some matters to be improved within the code    
  *Example:* `@todo Replace sprite images with pure CSS`    
  Multiple instances are allowed within the same section.
* **@fixme**: Some things needed to be fixed within the code    
  *Example:* `@fixme IE9 fails to draw this element correctly`    
  Multiple instances are allowed within the same section.

Also, first text line (e.g. with no tags) is considered to be the **block title**.  
All text lines going after the block title are considered to be **block description**.  
Any text lines, that go after the first tag encountered, are ignored.

*`@todo` revise the list, possible removing some strange tags (like `@version` and `@since`)*


Configuration
---------------

### Set templates directory
To create a showcase, StyleDoc need a template.

It looks for this template on path set in `styledoc.templates_dir` property.
* *For HTTP/browser mode*, default path is `js/styledoc/templates/` (relative to the HTML file).
* *For FS/NodeJS mode*, default path is `templates/` subdir inside module directory.

You can change this default value to any URL or relative path.
```javascript
styledoc.templates_dir = 'my/custom/templates/dir';
```
* *In HTTP/browser mode*, path value is relative to the HTML file.
* *In FS/NodeJS mode*, path value is relative to output directory.

*`@todo` other configurable properties*

### showcaseFile() method options
Showcase options can be provided as second argument
```javascript
styledoc.showcaseFile('css/mystyle.css', {
     /* options here */
});
```
#### Available options:
* **$container**: (HTTP mode only) JQuery element for root showcase container    
  *Default value:* `$('body')`
* **output_dir**: (FS mode only) Path for creating to showcase files, relative to current location    
  *Default value:* `'showcase/'`
* **template**: Name of showcase page template    
  *Default value:* `'default'`
* **language**: Language to apply when creating page (should exist in template's directory)    
  *Default value:* `'en'`
* **doctype**: Name of showcase page template (should exist in template's directory)    
  *Default value:* `'html5'`
* **page_title**: Main title (`<h1>`) of showcase page    
  *Default value for HTTP mode:* `document.title`    
  *Default value for FS mode:* `''`
* **iframe_delay**: Delay (ms) before refreshing iframe height    
  This delay is needed to render preview item iframe page, measure its height, and then apply this height to `<iframe>` element itself    
  *Default value:* `2000`
* **use_phantomjs**: (FS mode only) Use PhantomJS to pre-count and pre-set preview iframes height values (so iframe delay is not needed)    
  Requires PhantomJS to be installed in system    
  *Default value:* `false`
* **phantomjs_viewport**: (FS mode only) Viewport size for PhantomJS instances    
  *Default value:* `{ width: 1280, height: 800 }`
* **silent_mode**: (FS mode only) Disable console messages    
  *Default value:* `false`
* **preview_padding**: Padding value(s) for preview container    
  Useful if elements have `box-shadow`, `outline` or similar styles that don't affect the container offset size    
  Value can be *number* (`4 => padding: 4px`) or *array of numbers* (`[ 4, 3, 8 ] => padding: 4px 3px 8px`)    
  *Default value:* `undefined`
* **background_color**: Background color CSS value for both main showcase page and iframe preview pages (for seemless iframes)    
  Use when your target body color differs from value proposed by template (`#fff` for `default` template, `#000` for `dark` template, etc.)    
  Value should be string containing any CSS-valid color value (e.g. `"#f1f1f1"`, `"darkgray"`, or even `"rgb(17, 17, 36)"`)    
  *Default value:* `undefined`


### Creating your own template
*`@todo`*


Q & A
---------------

### Can I use StyleDoc with LESS, SASS, etc.?
Yes, you can. The easiest way is just to compile it CSS, preserving CSS-style comments, and then apply StyleDoc to the resulting CSS file.

### Does StyleDoc respect `@import` rules in CSS?
Yes, it does. The tool recursively loads and parses all imported CSS-files (as well as imports in that imported files, and so on).

### Can I load CSS file by HTTP URL?
Yes, you can. Just provide an URL instead of relative path to CSS when calling `styledoc.showcaseFile()`.  
Also, if you use StyleDoc in browser mode, CORS headers are needed for getting that file.

### How does live preview work?
Each element's preview is created in separate `<iframe>` with target CSS file linked and HTML content generated.

This approach prevents styles interference for main page and target CSS.

Also, StyleDoc tool preserves the same background color for main page and iframe live preview, so boudaries of that iframes are seemless.

### Why there is a delay before live preview appears?
Previews are [loaded within iframes](#how-does-live-preview-work), and it takes some time for them to render. After that, the tool needs to measure inner offset height of each preview and set this height value to the correspondent iframe element. And when this all is done, preview becomes visible.

Also, there is no reliable method for detecting the moment when rendering completes. That's why the tool sets a special delay after iframe reports it is "loaded". This delay defaults to 2000 ms, and could be changed with `iframe_delay` option for [showcaseFile() method](#showcasefile-method-options).

If your styles are light enough and seem to render faster, you may reduce this value, but keep in mind that some slower computers may need more time.

If the delay is too small, iframe could appear with wrong height (less or sometimes more than needed). But after you resizing page window, all iframe heights are remeasured (and probably fixed).

On the contrary, if your styles seem to be too heavy, or the computer is too slow, you can increase the value of `iframe_delay`.

But the best option is to use NodeJS mode [with PhantomJS enabled](#phantomjs-advantage). In this mode, PhantomJS pre-measures the height of each iframe, eliminating the necessity of iframe delay. Note that in that mode iframe heights aren't remeasured on window resize. Offset height for such iframes is measured only once, when PhantomJS renders it within virtual "window" (size of which defaults to 1280×800, and can be overriden with `phantomjs_viewport` option for [showcaseFile() method](#showcasefile-method-options)).


### Why `@state :hover` doesn't work?
Modifiers available for showcase are limited to CSS modifications applicable by adding or altering HTML attributes. `:hover` or `:active` cannot be applied with attributes (unlike `:checked`, `:disabled` or `:readonly`), so they are mainly useless for showcase.  
However, elements in showcase are full functional, so you can see the hover state of just by hovering the element by mouse.

### I cannot install NodeJS version on Windows
StyleDoc uses two npm modules that could cause problems on Windows.

#### JSDom dependency
On Windows, there are some known problems when installing **JSDom**, which is **required** for NodeJS version of the tool. If you are lucky, following manuals could help (if not, you can still use StyleDoc in HTTP/browser way):  
* http://www.steveworkman.com/node-js/2012/installing-jsdom-on-windows/
* https://github.com/tmpvar/jsdom#contextify

#### PhantomJS optional dependency
On Windows, there is also [an issue](http://stackoverflow.com/questions/20628345/node-gyp-rebuild-failed-while-installing-weak-module-on-windows-7-for-phantomj) when installing `phantom` (NodeJS library which used to communicate with **PhantomJS**).

However, *PhantomJS usage is just an option* giving you [some advantages](#phantomjs-advantage), so this dependency is marked **optional**, and StyleDoc installation won't fail if `phantom` couldn't be installed. You'll also see a warning message when generating showcase with `use_phantomjs` option enabled and no `phantom` package installed.

If you succeeded in fixing that issue, you can re-run `npm install`, which will try to install `phantom` package again.

### Is there a grunt wrapper for npm module?
*`@todo` make it*

### Can StyleDoc be used as AMD module?
Yes, it is AMD-compatible.  
*`@todo` test it*

### Can StyleDoc be used as CommonJS module in browser?
Yes, it should work.  
*`@todo` test it*

### Why new version of jQuery is required?
StyleDoc *requires jQuery version 1.11.1+ or 2.1.1+*.  
That is because showcase generator tool needs this particular change in jQuery *Sizzle* code:  
https://github.com/jquery/sizzle/commit/ccb809ff416b06ca86abe54ce273c40f2271d3b5.  
Without that, it cannot parse and apply CSS modifiers to HTML code.

### I use an older version of jQuery on my website. What can I do?
1. You can just use separate versions of jQuery for your website and showcase file.
2. You can manually modify your jQuery file, reproducing this change:  
https://github.com/jquery/sizzle/commit/ccb809ff416b06ca86abe54ce273c40f2271d3b5;  
simplier, just find `function tokenize(` in jquery .js file, and add `Sizzle.tokenize = tokenize;` somewhere after (or before) this function.

### Why npm module has such heavy dependencies?
For now, they all are needed for different reasons. I'll try to optimize these dependencies in future.

### Why the code is so ugly?
For now, it just does its dirty work.

Hope that during the way from 0.0.1 to 1.0.0 it will become more neat and beautiful :)


Version history
---------------
* **0.0.4** *(2014-11-30)*: Provide $.Deferred interface for showcaseFile
* **0.0.3** *(2014-11-30)*:
  * Optional dependency for `phantom`;
  * Support for `/*!` Stylus persistent ("buffered") comments;
  * Preview basic customization with `preview_padding` and `background_color` options;
  * Clickable titles (leading to their own anchors) on showcase page;
  * Bower support;
  * CommonJS-way require should now work in browser;
  * Minor improvements and bugfixes
* **0.0.2** *(2014-11-28)*: Examples added; minor changes, improvements and bugfixes
* **0.0.1** *(2014-11-27)*: Initial release
