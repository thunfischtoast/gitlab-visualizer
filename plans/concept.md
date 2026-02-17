# RACOON Gitlab Visualizer V2

The goal of this app is to give a better overview over a relatively complex Gitlab.

The Gitlab features multiple groups, projects, many issues and epics which correlate with each other.
Gitlab itself has limited features to get down this complexity.
Our app is a single page web app.
It prompts the user for a Gitlab API key and adress.
It pulls the data into the local browser for analyses.
No data is shared outside.
It features multiple views, switchable through tabs.
The main view is a hierarchical tabular collapsible overview over Groups, which have projects/repos, which have epics, which have tasks/issues.
It shows the epic/issues titles with numbers and links to the originals (on click). It shows the labels that are added to them.
It features quick filtering and sorting options.

## Coding Instructions

Simple and maintainable code. No overengineering. When in doubt ask the user for decisions.