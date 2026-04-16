// ==UserScript==
// @name         Draggable teamdynamix quick actions
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Adds a draggable button that inserts custom text into CKEditor
// @match        https://riversideca.teamdynamix.com/TDNext/*
// @updateurl    https://raw.githubusercontent.com/michaelrisher/tamperscripts/refs/heads/main/teamdynamixActions.js
// @downloadurl  https://raw.githubusercontent.com/michaelrisher/tamperscripts/refs/heads/main/teamdynamixActions.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @grant        none
// ==/UserScript==


(function () {
    'use strict';

    const STORAGE_KEY_POSITION = 'tmActionPanelPosition';
    const STORAGE_KEY_COLLAPSED = 'tmActionPanelCollapsed';

    const config = {
        title: 'Quick Actions',
        defaultPosition: {
            top: 120,
            left: 20
        },
        actions: [
            {
                label: 'Insert Greeting',
                action: () => {
                    let name = document.querySelector( '.panel-person-card .media .media-heading a' ).textContent ?? "";
                    name = name.split(' ')[0];
                    insertIntoEditor(`Hello ${name},\n\n`);
                }
            },
            {
                label: 'Insert Signature',
                action: () => {
                    insertIntoEditor('Please let me know if you need anything else.\n\nThanks,\nMichael Risher');
                }
            },
            {
                label: 'Mark Resolved',
                action: () => {
                    document.querySelector('#NewStatusId').value = 132659;
                    document.querySelector('#TimeAccountId').value = 7313;
                    document.querySelector('#TimeHours').value = prompt( "Enter hours" );
                    document.querySelector('#CommentsIsPrivate').checked = false;
                }
            },
            {
                label: 'Respond',
                action: () => {
                    let name = document.querySelector( '.panel-person-card .media .media-heading a' ).textContent ?? "";
                    name = name.split(' ')[0];
                    insertIntoEditor(`Hello ${name},\n\n`);
                    let m = prompt( "Input what did sentence" );
                    insertIntoEditor(`${m}. Please let me know if you need anything else.\n\nThanks,\nMichael Risher`);
                }
            },
            {
                label: 'Download All',
                action: () => {
                    let dls = [];
                    document.querySelectorAll( "#divAttachments .media span a" ).forEach( ( i ) => { dls.push( { url: i.href, name: i.textContent } ) } );
                    console.log( dls );
                    downloadFiles( dls );
                }
            }
            /*{
                label: 'Alert Test',
                action: () => {
                    alert('Custom action button clicked.');
                }
            },
            {
                label: 'Log Active Element',
                action: () => {
                    console.log('Active element:', document.activeElement);
                }
            }*/
        ]
    };


    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createPanel);
        } else {
            createPanel();
        }
    }

    function createPanel() {
        if (document.getElementById('tm-action-panel')) return;

        const savedPosition = loadPosition();
        const isCollapsed = loadCollapsedState();

        const panel = document.createElement('div');
        panel.id = 'tm-action-panel';

        Object.assign(panel.style, {
            position: 'fixed',
            top: `${savedPosition.top}px`,
            left: `${savedPosition.left}px`,
            zIndex: '999999',
            width: '220px',
            background: '#ffffff',
            border: '1px solid #cfcfcf',
            borderRadius: '12px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
            fontFamily: 'Arial, sans-serif',
            overflow: 'hidden'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '10px 12px',
            background: '#1f6feb',
            color: '#fff',
            cursor: 'move',
            fontSize: '14px',
            fontWeight: 'bold',
            userSelect: 'none'
        });

        const title = document.createElement('span');
        title.textContent = config.title;
        title.style.flex = '1';

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.textContent = isCollapsed ? '+' : '−';

        Object.assign(toggleButton.style, {
            border: 'none',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: '1'
        });

        const body = document.createElement('div');
        body.style.padding = '10px';
        body.style.display = isCollapsed ? 'none' : 'block';
        body.style.background = '#f8f9fb';

        for (const item of config.actions) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = item.label;

            Object.assign(btn.style, {
                display: 'block',
                width: '100%',
                marginBottom: '8px',
                padding: '10px',
                border: '1px solid #d0d7de',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'left'
            });

            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#f0f4ff';
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#fff';
            });

            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                try {
                    item.action();
                } catch (error) {
                    console.error('Action failed:', error);
                    alert('Action failed. Check console for details.');
                }
            });

            body.appendChild(btn);
        }

        header.appendChild(title);
        header.appendChild(toggleButton);
        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);

        toggleButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const collapsed = body.style.display === 'none';
            body.style.display = collapsed ? 'block' : 'none';
            toggleButton.textContent = collapsed ? '−' : '+';
            saveCollapsedState(!collapsed);
        });

        makeDraggable(panel, header);
    }

    function makeDraggable(panel, dragHandle) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        dragHandle.addEventListener('mousedown', (event) => {
            if (event.target.tagName === 'BUTTON') return;

            isDragging = true;
            startX = event.clientX;
            startY = event.clientY;
            startLeft = panel.offsetLeft;
            startTop = panel.offsetTop;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            event.preventDefault();
        });

        function onMouseMove(event) {
            if (!isDragging) return;

            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            let nextLeft = startLeft + dx;
            let nextTop = startTop + dy;

            const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

            nextLeft = clamp(nextLeft, 0, maxLeft);
            nextTop = clamp(nextTop, 0, maxTop);

            panel.style.left = `${nextLeft}px`;
            panel.style.top = `${nextTop}px`;
        }

        function onMouseUp() {
            if (!isDragging) return;

            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            savePosition({
                left: panel.offsetLeft,
                top: panel.offsetTop
            });
        }
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function savePosition(position) {
        try {
            localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(position));
        } catch (error) {
            console.warn('Could not save position:', error);
        }
    }

    function loadPosition() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_POSITION);
            if (!raw) return config.defaultPosition;

            const parsed = JSON.parse(raw);

            if (
                typeof parsed.left === 'number' &&
                typeof parsed.top === 'number'
            ) {
                return parsed;
            }
        } catch (error) {
            console.warn('Could not load saved position:', error);
        }

        return config.defaultPosition;
    }

    function saveCollapsedState(isCollapsed) {
        try {
            localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(isCollapsed));
        } catch (error) {
            console.warn('Could not save collapsed state:', error);
        }
    }

    function loadCollapsedState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_COLLAPSED);
            return raw ? JSON.parse(raw) : false;
        } catch (error) {
            console.warn('Could not load collapsed state:', error);
            return false;
        }
    }

    function insertIntoEditor(text) {
        if (tryCKEditor4InsertText(text)) return true;
        if (tryCKEditor5InsertText(text)) return true;

        const active = document.activeElement;

        if (active && active.isContentEditable) {
            insertTextAtCursorContentEditable(text);
            return true;
        }

        if (active && isTextInput(active)) {
            insertTextAtCursorInput(active, text);
            return true;
        }

        const editable = document.querySelector('[contenteditable="true"]');
        if (editable) {
            editable.focus();
            insertTextAtCursorContentEditable(text);
            return true;
        }

        alert('No supported editor found.');
        return false;
    }

    function insertHtmlIntoEditor(html) {
        if (tryCKEditor4InsertHtml(html)) return true;
        if (tryCKEditor5InsertText(stripHtml(html))) return true;

        const active = document.activeElement;

        if (active && active.isContentEditable) {
            insertHtmlAtCursorContentEditable(html);
            return true;
        }

        if (active && isTextInput(active)) {
            insertTextAtCursorInput(active, stripHtml(html));
            return true;
        }

        const editable = document.querySelector('[contenteditable="true"]');
        if (editable) {
            editable.focus();
            insertHtmlAtCursorContentEditable(html);
            return true;
        }

        alert('No supported editor found for HTML insertion.');
        return false;
    }

    function tryCKEditor4InsertText(text) {
        if (!window.CKEDITOR || !window.CKEDITOR.instances) return false;

        const instances = Object.values(window.CKEDITOR.instances);
        for (const editor of instances) {
            try {
                editor.focus();
                editor.insertText(text);
                return true;
            } catch (error) {
                console.warn('CKEditor 4 text insert failed:', error);
            }
        }

        return false;
    }

    function tryCKEditor4InsertHtml(html) {
        if (!window.CKEDITOR || !window.CKEDITOR.instances) return false;

        const instances = Object.values(window.CKEDITOR.instances);
        for (const editor of instances) {
            try {
                editor.focus();
                editor.insertHtml(html);
                return true;
            } catch (error) {
                console.warn('CKEditor 4 HTML insert failed:', error);
            }
        }

        return false;
    }

    function tryCKEditor5InsertText(text) {
        const editors = findCKEditor5Instances();

        for (const editor of editors) {
            try {
                editor.editing.view.focus();
                editor.model.change((writer) => {
                    editor.model.insertContent(writer.createText(text));
                });
                return true;
            } catch (error) {
                console.warn('CKEditor 5 insert failed:', error);
            }
        }

        return false;
    }

    function findCKEditor5Instances() {
        const editors = [];
        const possibleGlobals = [
            window.editor,
            window.Editor,
            window.myEditor,
            window.ckeditor,
            window.CKEditor5
        ];

        for (const item of possibleGlobals) {
            if (looksLikeCKEditor5(item) && !editors.includes(item)) {
                editors.push(item);
            }
        }

        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            for (const key in el) {
                let value;
                try {
                    value = el[key];
                } catch {
                    continue;
                }

                if (looksLikeCKEditor5(value) && !editors.includes(value)) {
                    editors.push(value);
                }
            }
        }

        return editors;
    }

    function looksLikeCKEditor5(obj) {
        return !!(
            obj &&
            obj.model &&
            obj.editing &&
            obj.editing.view
        );
    }

    function isTextInput(el) {
        return el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|url|tel|email|password)$/i.test(el.type));
    }

    function insertTextAtCursorInput(el, text) {
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        const value = el.value ?? '';

        el.value = value.slice(0, start) + text + value.slice(end);
        el.selectionStart = el.selectionEnd = start + text.length;

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function insertTextAtCursorContentEditable(text) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            document.execCommand('insertText', false, text);
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);
    }

    function insertHtmlAtCursorContentEditable(html) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            document.execCommand('insertHTML', false, html);
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const temp = document.createElement('div');
        temp.innerHTML = html;

        const fragment = document.createDocumentFragment();
        let lastNode = null;

        while (temp.firstChild) {
            lastNode = fragment.appendChild(temp.firstChild);
        }

        range.insertNode(fragment);

        if (lastNode) {
            range.setStartAfter(lastNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    init();
})();

async function downloadFiles( files, zipName ){
    const zip = new JSZip();

    for (const file of files) {
        try {
            const response = await fetch(file.url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${file.url}`);
            }

            const blob = await response.blob();
            zip.file(file.name, blob);
        } catch (error) {
            console.error(`Failed to fetch ${file.url}:`, error);
        }
    }

    const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    saveAs(zipBlob, zipName);
}