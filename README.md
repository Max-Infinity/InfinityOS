# Infinity OS
*Infinity OS* is a OS build using web technologies with its own bootloader and browser-encrypted FS. There you can download core of the system (excluding drivers and boot ISO)

The system has both simple tools out of the box (TextPad for text editing, media player, clock and settings), and user-oriented: Search engine without filters - Infinity Search in the system browser. Infinity Store with applications without ethical restrictions: The system has its own Node-runtime - the fs, ws and path modules have been adapted. Also, instead of complex APIs, Infinity OS uses console, alert, prompt, confirm redefinitions (the last 2 require await), and even the Notification constructor. All this is substituted into the code of executable JS and HTML, so the developer can simply write code as for a regular browser, and it will work natively in the system. FS stores File objects, instead of complex custom constructs.

NPM works via:
```
npmInstall(lib)
npmUpdate()
node(fileath)
```
Modules are stored in system/node_modules/ (note that unlike UNIX-like file systems, the slash at the beginning of paths is not used.)

# Contrubution
You can contribute by developing apps for Infinity OS and publishing them into Infinity Store.
You can submit you app and view mini-docs at: 

https://tally.so/r/MeYQ2l

More info about project at:

https://dev.to/max_f2ab6697eb4060d4bc660

User wiki and Dev Docs:

https://github.com/Max-Infinity/InfinityOS/wiki


