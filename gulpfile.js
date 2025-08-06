const { src, dest } = require('gulp');

function buildIcons() {
	return src('nodes/**/sqliteMemory.svg').pipe(dest('dist/'));
}

exports['build:icons'] = buildIcons;