#!/usr/local/bin/python3

from filecmp import dircmp
from difflib import context_diff

dcmp = dircmp("src","test")
dcmp.report()
dircmp("src/images","test/images").report()

for file in dcmp.diff_files:
    if file == ".DS_Store":
        continue
    fromFile,toFile = "src/"+file,"test/"+file
    with open(fromFile) as fromf, open(toFile) as tof:
        for diff in context_diff(list(fromf),list(tof),fromFile,toFile):
            print(diff,end='')
