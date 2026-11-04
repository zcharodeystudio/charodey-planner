export const richEditorScript = `
function mountRichEditor(root, post) {
  var editor = root;
  var model = [];
  var forced = null;
  var saved = null;
  var savedOffsets = { start: 0, end: 0 };
  var expanded = null;
  var silent = 0;
  var inputting = false;
  var MAX = 10000;
  editor.contentEditable = 'true';
  editor.spellcheck = true;
  editor.setAttribute('data-empty', '1');

  function postMessage(message) {
    try { post(message); } catch (error) {}
  }

  function knownSize(size) {
    if (size === 's') return '14';
    if (size === 'l') return '22';
    if (size === '12' || size === '14' || size === '16' || size === '18' || size === '22' || size === '28' || size === '36') return size;
    return '16';
  }

  function knownFont(font) {
    if (font === 'serif' || font === 'times' || font === 'script' || font === 'mono' || font === 'sans') return font;
    return 'sans';
  }

  function fontFamily(font) {
    if (font === 'serif') return 'Georgia, Palatino, serif';
    if (font === 'times') return 'Times New Roman, Times, serif';
    if (font === 'script') return 'Segoe Script, Segoe Print, cursive';
    if (font === 'mono') return 'Courier New, ui-monospace, Menlo, monospace';
    return 'inherit';
  }

  function styleOf(span) {
    return {
      bold: !!span.bold,
      italic: !!span.italic,
      underline: !!span.underline,
      size: knownSize(span.size),
      font: knownFont(span.font)
    };
  }

  function sameStyle(left, right) {
    return left.bold === right.bold && left.italic === right.italic && left.underline === right.underline && left.size === right.size && left.font === right.font;
  }

  function plain(spans) {
    var text = '';
    for (var i = 0; i < spans.length; i += 1) text += spans[i].text;
    return text;
  }

  function group(chars) {
    var out = [];
    for (var i = 0; i < chars.length; i += 1) {
      var item = chars[i];
      var last = out[out.length - 1];
      if (last && sameStyle(last, item.style)) last.text += item.ch;
      else out.push({ text: item.ch, bold: item.style.bold, italic: item.style.italic, underline: item.style.underline, size: item.style.size, font: item.style.font });
    }
    return out;
  }

  function charsOf(spans) {
    var chars = [];
    for (var i = 0; i < spans.length; i += 1) {
      var style = styleOf(spans[i]);
      var text = spans[i].text || '';
      for (var c = 0; c < text.length; c += 1) chars.push({ ch: text.charAt(c), style: style });
    }
    return chars;
  }

  function fontCss(style) {
    var px = Number(knownSize(style.size));
    var family = fontFamily(style.font);
    return 'font-weight:' + (style.bold ? '800' : '500') + ';font-style:' + (style.italic ? 'italic' : 'normal') + ';text-decoration:' + (style.underline ? 'underline' : 'none') + ';font-size:' + px + 'px;line-height:' + Math.round(px * 1.35) + 'px;font-family:' + family + ';';
  }

  function escapeText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render(spans) {
    silent += 1;
    var html = '';
    for (var i = 0; i < spans.length; i += 1) html += '<span style="' + fontCss(spans[i]) + '">' + escapeText(spans[i].text) + '</span>';
    editor.innerHTML = html;
    editor.setAttribute('data-empty', plain(spans) ? '0' : '1');
    silent -= 1;
    reportSize();
  }

  function reportSize() {
    postMessage({ type: 'height', height: Math.max(88, editor.scrollHeight) });
  }

  function textBefore(node) {
    var count = 0;
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    var current;
    while ((current = walker.nextNode())) {
      if (current === node) return count;
      count += current.textContent.length;
    }
    return count;
  }

  function pointOffset(container, offset) {
    if (!container) return 0;
    if (container.nodeType === 3) return textBefore(container) + offset;
    var count = container === editor ? 0 : textBefore(container);
    var children = container.childNodes;
    for (var i = 0; i < offset && i < children.length; i += 1) count += nodeLength(children[i]);
    return count;
  }

  function nodeLength(node) {
    if (node.nodeType === 3) return node.textContent.length;
    if (node.tagName === 'BR') return 1;
    var count = 0;
    for (var i = 0; i < node.childNodes.length; i += 1) count += nodeLength(node.childNodes[i]);
    return count;
  }

  function selectionOffsets() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return { start: 0, end: 0 };
    var range = sel.getRangeAt(0);
    if (!editor.contains(range.startContainer) && range.startContainer !== editor) return null;
    var start = pointOffset(range.startContainer, range.startOffset);
    var end = pointOffset(range.endContainer, range.endOffset);
    if (end < start) { var swap = start; start = end; end = swap; }
    return { start: start, end: end };
  }

  function pointAt(offset) {
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    var left = offset;
    var node;
    var last = null;
    while ((node = walker.nextNode())) {
      last = node;
      if (left <= node.textContent.length) return { node: node, offset: left };
      left -= node.textContent.length;
    }
    if (last) return { node: last, offset: last.textContent.length };
    return null;
  }

  function selectOffsets(start, end) {
    savedOffsets = { start: start, end: end };
    expanded = start === end ? null : { start: start, end: end };
    var a = pointAt(start);
    var b = pointAt(end);
    if (!a || !b) return;
    silent += 1;
    var range = document.createRange();
    range.setStart(a.node, Math.min(a.offset, a.node.textContent.length));
    range.setEnd(b.node, Math.min(b.offset, b.node.textContent.length));
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    saved = range.cloneRange();
    silent -= 1;
  }

  function activeRange() {
    var live = selectionOffsets();
    if (live && live.start !== live.end) return live;
    if (expanded) return expanded;
    if (live) return live;
    return savedOffsets;
  }

  function styleInRange(start, end) {
    if (start === end) return forced || styleAt(start);
    var chars = charsOf(model).slice(start, end);
    if (!chars.length) return styleAt(start);
    var style = styleOf(chars[0].style);
    for (var i = 1; i < chars.length; i += 1) {
      var next = styleOf(chars[i].style);
      if (!next.bold) style.bold = false;
      if (!next.italic) style.italic = false;
      if (!next.underline) style.underline = false;
      if (next.size !== style.size) style.size = '';
      if (next.font !== style.font) style.font = '';
    }
    return style;
  }

  function styleAt(index) {
    var cursor = 0;
    var previous = null;
    for (var i = 0; i < model.length; i += 1) {
      var next = cursor + model[i].text.length;
      if (index === 0) return styleOf(model[0]);
      if (index > cursor && index <= next) return styleOf(model[i]);
      previous = model[i];
      cursor = next;
    }
    return previous ? styleOf(previous) : { bold: false, italic: false, underline: false, size: 'm', font: 'sans' };
  }

  function displayStyle() {
    var range = activeRange();
    return styleInRange(range.start, range.end);
  }

  function publish() {
    postMessage({ type: 'change', spans: model, text: plain(model).slice(0, MAX) });
    postMessage({ type: 'caret', style: displayStyle() });
  }

  function readDomStyle(node) {
    var style = { bold: false, italic: false, underline: false, size: 'm', font: 'sans' };
    var current = node;
    while (current && current !== editor) {
      if (current.nodeType === 1) {
        var el = current;
        var weight = (el.style && el.style.fontWeight) || '';
        if (el.tagName === 'B' || el.tagName === 'STRONG' || weight === '800' || weight === '700' || weight === 'bold') style.bold = true;
        if (el.tagName === 'I' || el.tagName === 'EM' || (el.style && el.style.fontStyle === 'italic')) style.italic = true;
        var deco = (el.style && (el.style.textDecorationLine || el.style.textDecoration)) || '';
        if (el.tagName === 'U' || deco.indexOf('underline') >= 0) style.underline = true;
        var px = parseInt(el.style && el.style.fontSize, 10);
        if (px === 12 || px === 14 || px === 16 || px === 18 || px === 22 || px === 28 || px === 36) style.size = String(px);
        var family = ((el.style && el.style.fontFamily) || '').toLowerCase();
        if (family.indexOf('courier') >= 0 || family.indexOf('mono') >= 0 || family.indexOf('menlo') >= 0) style.font = 'mono';
        else if (family.indexOf('script') >= 0 || family.indexOf('cursive') >= 0 || family.indexOf('comic') >= 0) style.font = 'script';
        else if (family.indexOf('times') >= 0) style.font = 'times';
        else if (family.indexOf('georgia') >= 0 || family.indexOf('palatino') >= 0) style.font = 'serif';
        else if (family && family !== 'inherit') style.font = 'sans';
      }
      current = current.parentNode;
    }
    return style;
  }

  function readDom() {
    var chars = [];
    function walk(node) {
      if (node.nodeType === 3) {
        var text = (node.textContent || '').replace(/\\u200b/g, '');
        var style = readDomStyle(node);
        for (var i = 0; i < text.length; i += 1) chars.push({ ch: text.charAt(i), style: style });
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.tagName === 'BR') {
        chars.push({ ch: '\\n', style: readDomStyle(node) });
        return;
      }
      var block = node !== editor && (node.tagName === 'DIV' || node.tagName === 'P');
      if (block && chars.length && chars[chars.length - 1].ch !== '\\n') chars.push({ ch: '\\n', style: readDomStyle(node) });
      for (var i = 0; i < node.childNodes.length; i += 1) walk(node.childNodes[i]);
    }
    walk(editor);
    return group(chars);
  }

  function applyDiff(spans, start, removed, inserted, style) {
    var chars = charsOf(spans);
    var added = [];
    for (var i = 0; i < inserted.length; i += 1) added.push({ ch: inserted.charAt(i), style: style });
    return group(chars.slice(0, start).concat(added, chars.slice(start + removed)));
  }

  function sameModel(left, right) {
    if (left.length !== right.length) return false;
    for (var i = 0; i < left.length; i += 1) {
      if (left[i].text !== right[i].text || !sameStyle(styleOf(left[i]), styleOf(right[i]))) return false;
    }
    return true;
  }

  function onInput() {
    if (silent) return;
    expanded = null;
    var domText = plain(readDom());
    if (domText.length > MAX) {
      render(model);
      selectOffsets(Math.min(plain(model).length, MAX), Math.min(plain(model).length, MAX));
      inputting = false;
      return;
    }
    var previous = plain(model);
    var start = 0;
    while (start < previous.length && start < domText.length && previous.charAt(start) === domText.charAt(start)) start += 1;
    var endPrev = previous.length;
    var endNext = domText.length;
    while (endPrev > start && endNext > start && previous.charAt(endPrev - 1) === domText.charAt(endNext - 1)) {
      endPrev -= 1;
      endNext -= 1;
    }
    var inserted = domText.slice(start, endNext);
    var style = forced || styleAt(start);
    model = applyDiff(model, start, endPrev - start, inserted, style);
    var dom = readDom();
    if (!sameModel(dom, model)) {
      render(model);
      selectOffsets(start + inserted.length, start + inserted.length);
    }
    inputting = false;
    publish();
  }

  editor.addEventListener('beforeinput', function (event) {
    inputting = true;
    if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
      event.preventDefault();
      document.execCommand('insertText', false, '\\n');
    }
  });
  editor.addEventListener('paste', function (event) {
    event.preventDefault();
    var text = '';
    if (event.clipboardData) text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text.slice(0, MAX));
  });
  editor.addEventListener('input', onInput);
  editor.addEventListener('keyup', function (event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Home' || event.key === 'End') {
      forced = null;
      var offsets = selectionOffsets();
      if (!offsets || offsets.start === offsets.end) expanded = null;
    }
    publish();
  });
  editor.addEventListener('pointerdown', function () {
    forced = null;
    expanded = null;
  });
  editor.addEventListener('blur', function () {
    if (expanded) savedOffsets = { start: expanded.start, end: expanded.end };
  });
  document.addEventListener('selectionchange', function () {
    if (silent || !document.hasFocus() || document.activeElement !== editor) return;
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var node = sel.anchorNode;
    if (!node || (node !== editor && !editor.contains(node))) return;
    saved = sel.getRangeAt(0).cloneRange();
    var offsets = selectionOffsets();
    if (!offsets) return;
    savedOffsets = { start: offsets.start, end: offsets.end };
    if (offsets.start !== offsets.end) expanded = { start: offsets.start, end: offsets.end };
    if (!inputting) postMessage({ type: 'caret', style: displayStyle() });
  });

  function patchRange(start, end, patch) {
    var chars = charsOf(model);
    for (var i = start; i < end && i < chars.length; i += 1) {
      var next = styleOf(chars[i].style);
      if (patch.bold !== undefined) next.bold = patch.bold;
      if (patch.italic !== undefined) next.italic = patch.italic;
      if (patch.underline !== undefined) next.underline = patch.underline;
      if (patch.size) next.size = knownSize(patch.size);
      if (patch.font) next.font = knownFont(patch.font);
      chars[i].style = next;
    }
    model = group(chars);
    render(model);
    selectOffsets(start, end);
  }

  function init(spans) {
    model = [];
    var source = spans || [];
    for (var i = 0; i < source.length; i += 1) {
      if (!source[i] || !source[i].text) continue;
      model.push({ text: String(source[i].text).slice(0, MAX), bold: !!source[i].bold, italic: !!source[i].italic, underline: !!source[i].underline, size: knownSize(source[i].size), font: knownFont(source[i].font) });
    }
    if (plain(model).length > MAX) model = applyDiff(model, MAX, plain(model).length - MAX, '', styleAt(0));
    forced = null;
    expanded = null;
    savedOffsets = { start: 0, end: 0 };
    render(model);
  }

  function command(desired) {
    var range = activeRange();
    var current = styleInRange(range.start, range.end);
    var patch = {};
    if (desired.toggle === 'bold') patch.bold = !current.bold;
    if (desired.toggle === 'italic') patch.italic = !current.italic;
    if (desired.toggle === 'underline') patch.underline = !current.underline;
    if (desired.size && knownSize(desired.size) !== (current.size ? knownSize(current.size) : '')) patch.size = knownSize(desired.size);
    if (desired.font && desired.font !== current.font) patch.font = desired.font;
    editor.focus();
    if (patch.bold === undefined && patch.italic === undefined && patch.underline === undefined && !patch.size && !patch.font) {
      selectOffsets(range.start, range.end);
      return;
    }
    if (range.start === range.end) {
      var next = {
        bold: !!current.bold,
        italic: !!current.italic,
        underline: !!current.underline,
        size: current.size ? knownSize(current.size) : '16',
        font: knownFont(current.font)
      };
      if (patch.bold !== undefined) next.bold = patch.bold;
      if (patch.italic !== undefined) next.italic = patch.italic;
      if (patch.underline !== undefined) next.underline = patch.underline;
      if (patch.size) next.size = knownSize(patch.size);
      if (patch.font) next.font = knownFont(patch.font);
      forced = next;
      selectOffsets(range.start, range.end);
      postMessage({ type: 'caret', style: next });
      return;
    }
    patchRange(range.start, range.end, patch);
    publish();
  }

  return { init: init, command: command, focus: function () { editor.focus(); } };
}
`;
