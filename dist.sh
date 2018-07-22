#!/bin/bash

dir=dilim-win32-ia32

cp -v lib.xls config.toml build/$dir
cd build
rm -rf dilim
cp -r $dir dilim

zip -r dilim.zip dilim
zip -t dilim.zip
du -h dilim.zip
echo done