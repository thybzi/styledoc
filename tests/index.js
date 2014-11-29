var should = require('chai').should(),
    styledoc = require('../styledoc'),
    fs = require('../node_modules/fs-extra');


describe('#htmlApplyModifier', function () {
    var ham = styledoc.htmlApplyModifier;

    it('class modifier: add first class', function () {
        ham('<a></a>', 'a', '.b').should.equal('<a class="b"></a>');
    });

    it('class modifier: add another class', function () {
        ham('<a class="b"></a>', '.b', '.c').should.equal('<a class="b c"></a>');
    });

    it('id modifier', function () {
        ham('<a></a>', 'a', '#b').should.equal('<a id="b"></a>');
    });

    it('pseudo modifier', function () {
        ham('<a></a>', 'a', ':disabled').should.equal('<a disabled="disabled"></a>'); // @todo html5
    });

    it('attr modifier', function () {
        ham('<a></a>', 'a', '[href=#]').should.equal('<a href="#"></a>');
    });

    it('complex modifier', function () {
        ham('<a></a>', 'a', '.b.c#d:disabled[href=#]').should.equal('<a class="b c" id="d" disabled="disabled" href="#"></a>');
    });


    it('not existing base', function () {
        ham('<a class="b"></a>', '.d', '.c').should.equal('<a class="b"></a>');
    });

    it('with children', function () {
        ham('<a><i></i><u></u></a>', 'a', '.b', '<a class="b"><i></i><u></u></a>');    
    });

    it('modify children', function () {
        ham('<a><b></b><b></b></a>', 'b', '.c', '<a><b class="c"></b><b class="c"></b></a>');
    });

});


describe('#parseDoc', function () {
    var pd = styledoc.parseDoc;

    it('basic doc', function () {
        var raw = fs.readFileSync('tests/basic.css', 'utf-8');
        var doc = pd(raw);

        doc[0][0].should.equal('$title');
        doc[0][1].should.equal('Buttons');
        doc[1][0].should.equal('$description');
        doc[1][1].should.equal('All different kind of buttons,\nwhich are used in application');
        doc[2][0].should.equal('base');
        doc[2][1].should.equal('button Normal button');

        doc[3][0].should.equal('modifier');
        doc[3][1].should.equal('.large Large button');
        doc[4][0].should.equal('modifier');
        doc[4][1].should.equal(':disabled Button unable to be pressed');
        doc[5][0].should.equal('modifier');
        doc[5][1].should.equal('.large:disabled Large button disabled');

        doc[6][0].should.equal('example');
        doc[6][1].should.equal('<button>Button text</button>');
    });

    // todo test bug with multiline content going last vs space after */ end


    // @todo dry
    it('stylus persistent doc', function () {
        var raw = fs.readFileSync('tests/stylus.css', 'utf-8');
        var doc = pd(raw);

        doc[0][0].should.equal('$title');
        doc[0][1].should.equal('Buttons');
        doc[1][0].should.equal('$description');
        doc[1][1].should.equal('All different kind of buttons,\nwhich are used in application');
        doc[2][0].should.equal('base');
        doc[2][1].should.equal('button Normal button');

        doc[3][0].should.equal('modifier');
        doc[3][1].should.equal('.large Large button');
        doc[4][0].should.equal('modifier');
        doc[4][1].should.equal(':disabled Button unable to be pressed');
        doc[5][0].should.equal('modifier');
        doc[5][1].should.equal('.large:disabled Large button disabled');

        doc[6][0].should.equal('example');
        doc[6][1].should.equal('<button>Button text</button>');
    });

});

