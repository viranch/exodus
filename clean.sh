#!/bin/bash
find * -type f ! -iname \*.jpg ! -iname \*.png | while read; do
    gsed -i 's///g' "$p"
done
