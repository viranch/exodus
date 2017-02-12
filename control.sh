#!/bin/bash

function pg() {
    ps aux | grep "$*" | grep -vw "grep" | grep --color=auto "$*"
}

if [[ $1 == "run" ]]; then
    while true; do
        python app.py
        test $? -gt 128 && echo exit && break
        echo
    done
elif [[ $1 == "stop" ]]; then
    kill -TERM `pg 'python app' | awk '{print $2}'`
else
    echo "Unknown command: $1"
fi
