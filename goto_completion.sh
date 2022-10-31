#!/usr/bin/env bash
SOURCE=${BASH_SOURCE[0]}
while [ -L "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  TARGET=$(readlink "$SOURCE")
  if [[ $TARGET == /* ]]; then
    # "SOURCE '$SOURCE' is an absolute symlink to '$TARGET'"
    SOURCE=$TARGET
  else
    # "SOURCE '$SOURCE' is a relative symlink to '$TARGET' (relative to '$DIR')"
    SOURCE=$DIR/$TARGET # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
  fi
done

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
