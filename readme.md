# hyper-statuspro

> Status Plugin for [Hyper](https://hyper.is). Shows clickable & useful information. Matches any theme.

## Install

Add following to your `~/.hyper.js` config.

```javascript
module.exports = {
  ...
  plugins: ['hyper-statuspro']
  ...
}
```


## Config

Add following to `~/.hyper.js`

### Change Git Dirty Color
Expected value is `CSS color`

```javascript
module.exports = {
  config: {
    ...
      hyperStatusLine: {
        dirtyColor: 'salmon',
      }
    ...
  }
}
```

### Change Git Ahead Color
Expected value is `CSS color`

```javascript
module.exports = {
  config: {
    ...
      hyperStatusLine: {
        aheadColor: 'ivory',
      }
    ...
  }
}
```

### Disable Footer Transparency
Default value is set to `true`

```javascript
module.exports = {
  config: {
    ...
      hyperStatusLine: {
        footerTransparent: false,
      }
    ...
  }
}
```


## Theme

* [hyper-chesterish](https://github.com/henrikdahl/hyper-chesterish)


## License

MIT © Henrik
