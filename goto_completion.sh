#!/usr/bin/env bash

_goto_completion() {
  local directories arg
  arg=${COMP_WORDS[COMP_CWORD]}
  if [ ! -z "$arg" ]
  then
    directories=$(/var/www/tools/goto.js ${COMP_WORDS[COMP_CWORD]})
    if [ "$?" -eq 0 ]
    then
      COMPREPLY=( $(compgen -W "${directories}") )
    fi
  fi
}

complete -F _goto_completion goto
