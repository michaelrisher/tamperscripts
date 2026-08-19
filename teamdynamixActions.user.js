// ==UserScript==
// @name         Draggable teamdynamix quick actions
// @namespace    http://github.com/michaelrisher/tamperscripts/
// @version      1.6
// @description  Adds a draggable button that inserts custom text into CKEditor
// @match        https://riversideca.teamdynamix.com/TDNext/*
// @match        https://riversideca.teamdynamix.com/TDWorkManagement/
// @exclude      https://riversideca.teamdynamix.com/TDNext/Apps/Shared/*
// @exclude      https://riversideca.teamdynamix.com/TDNext/Apps/2814/Tickets/TicketSearch*
// @updateurl    https://raw.githubusercontent.com/michaelrisher/tamperscripts/refs/heads/main/teamdynamixActions.js
// @downloadurl  https://raw.githubusercontent.com/michaelrisher/tamperscripts/refs/heads/main/teamdynamixActions.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @require      https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js
// @grant        none
// ==/UserScript==


(function () {
    'use strict';

    class Configuration {
        STORAGE_KEY = 'tmActionPanelConfig';

        constructor() {
            this.name = 'Your Name';
            this.signature = 'Please let me know if you need anything else.\n\nThanks,\n{{name}}';
            this.position = { top: 120, left: 20 };
            this.title = 'Quick Actions';
            this.customActions = [];
            this.loaded = false;
            this.modalOpen = false;
        }

        load() {
            try{
                let raw = localStorage.getItem( this.STORAGE_KEY );
                //replace with loaded values if found
                if( raw ) {
                    let parsed = JSON.parse( raw );
                    if( parsed.name ) this.name = parsed.name;
                    if( parsed.signature ) this.signature = parsed.signature;
                    if( parsed.timeTrack ) this.timeTrack = parsed.timeTrack;
                    if( parsed.position ) this.position = parsed.position;
                    if( parsed.title ) this.title = parsed.title;
                    let cas = JSON.parse( LZString.decompressFromUTF16( parsed.customActions ) );
                    if( Array.isArray( cas ) ) this.customActions = cas;
                    this.loaded = true
                    
                }
            } catch( error ) {
                console.warn( 'Could not load configuration:', error );
            }
            return this.loaded
        }

        save() {
            try{
                let cas = JSON.stringify( this.customActions );
                cas = LZString.compressToUTF16( cas );
                localStorage.setItem( this.STORAGE_KEY, JSON.stringify( {
                    name: this.name,
                    signature: this.signature,
                    position: this.position,
                    title: this.title,
                    customActions: cas
                } ) );
            } catch( error ) {
                console.warn( 'Could not save configuration:', error );
            }
        }

        displayModal(onSave) {
            if( this.modalOpen ) return;
            this.modalOpen = true;
            const modal = document.createElement('div');
            modal.className =  'tm-config-modal';

            const header = document.createElement('div');
            header.className = 'tm-header';

            const title = document.createElement('span');
            title.textContent = 'Configure';
            title.style.flex = '1';

            const body = document.createElement( 'div' );
            body.className ='tm-body';

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.placeholder = 'Title';
            titleInput.value = this.title;

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'Your Name';
            nameInput.value = this.name;

            const signatureInput = document.createElement('textarea');
            signatureInput.placeholder = 'Default Signature';
            signatureInput.value = this.signature;

            const customHeader = document.createElement('div');
            customHeader.className = 'tm-section-title';
            customHeader.textContent = 'Custom Actions';

            const customActionsContainer = document.createElement('div');
            customActionsContainer.className = 'tm-custom-actions-config';

            const setAccordionState = (targetRow, shouldOpen) => {
                const allRows = customActionsContainer.querySelectorAll('.tm-custom-action-row');
                allRows.forEach((row) => {
                    const body = row.querySelector('.tm-custom-action-body');
                    const chevron = row.querySelector('.tm-custom-action-chevron');
                    const isTarget = row === targetRow;
                    const open = isTarget && shouldOpen;

                    row.classList.toggle('is-open', open);
                    if (body) body.style.display = open ? 'flex' : 'none';
                    if (chevron) chevron.textContent = open ? '−' : '+';
                });
            };

            const createCustomActionRow = (action = {}) => {
                const row = document.createElement('div');
                row.className = 'tm-custom-action-row';

                const headerButton = document.createElement('button');
                headerButton.type = 'button';
                headerButton.className = 'tm-custom-action-header';

                const headerLabel = document.createElement('span');
                headerLabel.className = 'tm-custom-action-header-label';
                headerLabel.textContent = (action.label || '').trim() || 'New action';

                const headerChevron = document.createElement('span');
                headerChevron.className = 'tm-custom-action-chevron';
                headerChevron.textContent = '+';

                headerButton.appendChild(headerLabel);
                headerButton.appendChild(headerChevron);

                const rowBody = document.createElement('div');
                rowBody.className = 'tm-custom-action-body';
                rowBody.style.display = 'none';

                const actionLabelInput = document.createElement('input');
                actionLabelInput.className = 'tm-custom-action-label';
                actionLabelInput.type = 'text';
                actionLabelInput.placeholder = 'Button label';
                actionLabelInput.value = action.label ?? '';
                actionLabelInput.addEventListener('input', () => {
                    const nextLabel = actionLabelInput.value.trim();
                    headerLabel.textContent = nextLabel || 'New action';
                });

                const actionModeSelect = document.createElement('select');
                actionModeSelect.className = 'tm-custom-action-mode';
                const insertTextOption = document.createElement('option');
                insertTextOption.value = 'insertText';
                insertTextOption.textContent = 'Insert text into editor';
                const runJsOption = document.createElement('option');
                runJsOption.value = 'runJs';
                runJsOption.textContent = 'Run JavaScript';
                actionModeSelect.appendChild(insertTextOption);
                actionModeSelect.appendChild(runJsOption);
                actionModeSelect.value = action.mode === 'runJs' ? 'runJs' : 'insertText';

                const actionContentInput = document.createElement('textarea');
                actionContentInput.className = 'tm-custom-action-content';
                actionContentInput.value = action.mode === 'runJs' ? (action.script ?? '') : (action.text ?? '');

                const updateContentInputForMode = () => {
                    const mode = actionModeSelect.value;
                    if (mode === 'runJs') {
                        actionContentInput.placeholder = 'JavaScript to run (helpers, configuration, customAction available)';
                    } else {
                        actionContentInput.placeholder = 'Text to insert when clicked';
                    }
                };
                updateContentInputForMode();
                actionModeSelect.addEventListener('change', updateContentInputForMode);

                const actionPageInput = document.createElement('input');
                actionPageInput.className = 'tm-custom-action-url-pattern';
                actionPageInput.type = 'text';
                actionPageInput.placeholder = 'URL pattern (optional, regex)';
                actionPageInput.value = action.urlPattern ?? '';

                const actionWidthSelect = document.createElement('select');
                actionWidthSelect.className = 'tm-custom-action-width';
                const fullOption = document.createElement('option');
                fullOption.value = 'full';
                fullOption.textContent = 'Full width';
                const halfOption = document.createElement('option');
                halfOption.value = 'half';
                halfOption.textContent = 'Half width';
                actionWidthSelect.appendChild(fullOption);
                actionWidthSelect.appendChild(halfOption);
                actionWidthSelect.value = action.class === 'half' ? 'half' : 'full';

                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.textContent = 'Remove';
                removeButton.className = 'tm-btn tm-btn-danger';
                removeButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    customActionsContainer.removeChild(row);
                });

                headerButton.addEventListener('click', () => {
                    const isOpen = row.classList.contains('is-open');
                    setAccordionState(row, !isOpen);
                });

                rowBody.appendChild(actionLabelInput);
                rowBody.appendChild(actionModeSelect);
                rowBody.appendChild(actionContentInput);
                rowBody.appendChild(actionPageInput);
                rowBody.appendChild(actionWidthSelect);
                rowBody.appendChild(removeButton);

                row.appendChild(headerButton);
                row.appendChild(rowBody);

                return row;
            };

            const addCustomActionButton = document.createElement('button');
            addCustomActionButton.type = 'button';
            addCustomActionButton.textContent = 'Add Action';
            addCustomActionButton.className = 'tm-btn tm-btn-secondary';
            addCustomActionButton.addEventListener('click', () => {
                const row = createCustomActionRow();
                customActionsContainer.appendChild(row);
                setAccordionState(row, true);
            });

            (this.customActions || []).forEach((action) => {
                customActionsContainer.appendChild(createCustomActionRow(action));
            });

            const saveButton = document.createElement('button');
            saveButton.textContent = 'Save';
            saveButton.className = 'tm-btn tm-btn-primary';


            saveButton.addEventListener('click', () => {
                this.title = titleInput.value.trim();
                this.name = nameInput.value;
                this.signature = signatureInput.value.replaceAll( '{{name}}', nameInput.value );
                this.customActions = [...customActionsContainer.querySelectorAll('.tm-custom-action-row')]
                    .map((row) => {
                        const label = (row.querySelector('.tm-custom-action-label')?.value || '').trim();
                        const mode = row.querySelector('.tm-custom-action-mode')?.value === 'runJs' ? 'runJs' : 'insertText';
                        const content = (row.querySelector('.tm-custom-action-content')?.value || '').trim();
                        const urlPattern = (row.querySelector('.tm-custom-action-url-pattern')?.value || '').trim();
                        const width = row.querySelector('.tm-custom-action-width')?.value === 'half' ? 'half' : '';

                        if (!label || !content) return null;

                        const payload = {
                            mode,
                            text: mode === 'insertText' ? content : '',
                            script: mode === 'runJs' ? content : ''
                        };

                        return {
                            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            label,
                            urlPattern,
                            class: width,
                            ...payload
                        };
                    })
                    .filter(Boolean);
                this.save();
                document.body.removeChild(shadowBg);
                document.body.removeChild(modal);
                this.modalOpen = false;
                if (typeof onSave === 'function') {
                    onSave();
                }
            });

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.className = 'tm-btn tm-btn-secondary';
            cancelButton.addEventListener('click', () => {
                document.body.removeChild(shadowBg);
                document.body.removeChild(modal);
                this.modalOpen = false;
            });

            const footer = document.createElement('div');
            footer.className = 'tm-modal-footer';
            footer.appendChild(cancelButton);
            footer.appendChild(saveButton);

            //create shadow behind modal
            const shadowBg = document.createElement( 'div' );
            shadowBg.className = 'tm-shadow-backdrop';
            

            header.appendChild( title );

            body.appendChild(titleInput);
            body.appendChild(nameInput);
            body.appendChild(signatureInput);
            body.appendChild(customHeader);
            body.appendChild(addCustomActionButton);
            body.appendChild(customActionsContainer);
            body.appendChild(footer);

            modal.appendChild( header );
            modal.appendChild( body );

            document.body.appendChild( shadowBg );
            document.body.appendChild(modal);
        }

        get(key) {
            return this[key];
        }

        getHtml(key){
            return this[key].replace(/\n/g, '<br>');
        }

        set(key, v){
            this[key] = v;
            this.save();
        }
    }

    const STYLES = `
:root {
    --tm-font: "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --tm-bg: #f4f7fc;
    --tm-surface: #ffffff;
    --tm-surface-soft: #f8faff;
    --tm-border: #d7deea;
    --tm-border-strong: #c4cfe1;
    --tm-text: #1a2333;
    --tm-text-muted: #5f6f86;
    --tm-primary: #2764ff;
    --tm-primary-hover: #1d54e0;
    --tm-primary-soft: #e8efff;
    --tm-danger: #dd3b3b;
    --tm-radius-sm: 10px;
    --tm-radius-md: 14px;
    --tm-radius-lg: 18px;
    --tm-shadow: 0 18px 40px rgba(15, 27, 64, 0.22);
    --tm-shadow-soft: 0 10px 24px rgba(15, 27, 64, 0.12);
}

#tm-action-panel,
.tm-config-modal,
#td-download-progress {
    font-family: var(--tm-font);
    color: var(--tm-text);
}

#tm-action-panel {
    position: fixed;
    z-index: 999999;
    width: 260px;
    background: var(--tm-surface);
    border: 1px solid var(--tm-border);
    border-radius: var(--tm-radius-lg);
    box-shadow: var(--tm-shadow);
    overflow: hidden;
    backdrop-filter: blur(10px);
}

.tm-shadow-backdrop {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: rgba(13, 20, 35, 0.45);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 999998;
    animation: tmFadeIn 0.16s ease-out;
}

.tm-config-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(760px, 94vw);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    z-index: 999999;
    background: var(--tm-surface);
    border: 1px solid var(--tm-border);
    border-radius: var(--tm-radius-lg);
    box-shadow: var(--tm-shadow);
    overflow: hidden;
    animation: tmScaleIn 0.16s ease-out;
}

#tm-action-panel .tm-header,
.tm-config-modal .tm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
    background: linear-gradient(135deg, #1f5bff, #2b78ff 60%, #4098ff);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    user-select: none;
}

#tm-action-panel .tm-header {
    cursor: move;
}

.tm-config-modal .tm-header {
    cursor: default;
}

#tm-action-panel .tm-header button {
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    transition: all 0.14s ease;
}

#tm-action-panel .tm-header button:hover {
    background: rgba(255, 255, 255, 0.24);
    transform: translateY(-1px);
}

#tm-action-panel .tm-actions {
    padding: 10px;
    background: var(--tm-bg);
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
}

#tm-action-panel .tm-actions .tm-action-btn {
    display: block;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--tm-border);
    border-radius: var(--tm-radius-sm);
    background: var(--tm-surface);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1px;
    text-align: left;
    color: var(--tm-text);
    transition: all 0.14s ease;
}

#tm-action-panel .tm-actions .tm-action-btn.half {
    width: calc(50% - 4px);
}

#tm-action-panel .tm-actions .tm-action-btn:hover,
#tm-action-panel .tm-actions .tm-action-btn:active {
    background: var(--tm-primary-soft);
    border-color: #adc2f9;
    transform: translateY(-1px);
}

.tm-config-modal .tm-body {
    padding: 14px;
    background: var(--tm-bg);
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
}

.tm-config-modal .tm-body input,
.tm-config-modal .tm-body textarea,
.tm-config-modal .tm-body select {
    width: 100%;
    border: 1px solid var(--tm-border);
    border-radius: var(--tm-radius-sm);
    background: var(--tm-surface);
    color: var(--tm-text);
    padding: 9px 11px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.14s ease, box-shadow 0.14s ease;
}

.tm-config-modal .tm-body input:focus,
.tm-config-modal .tm-body textarea:focus,
.tm-config-modal .tm-body select:focus {
    border-color: #8eaef7;
    box-shadow: 0 0 0 3px rgba(39, 100, 255, 0.14);
}

.tm-config-modal .tm-body textarea {
    min-height: 100px;
    resize: vertical;
}

.tm-section-title {
    width: 100%;
    margin-top: 4px;
    margin-bottom: 2px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--tm-text-muted);
}

.tm-config-modal .tm-custom-actions-config {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.tm-config-modal .tm-custom-action-row {
    width: 100%;
    border: 1px solid var(--tm-border);
    border-radius: var(--tm-radius-md);
    background: var(--tm-surface);
    overflow: hidden;
    box-shadow: var(--tm-shadow-soft);
}

.tm-config-modal .tm-custom-action-header {
    width: 100%;
    border: none;
    border-bottom: 1px solid #ecf1fb;
    background: #ffffff;
    padding: 11px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    color: var(--tm-text);
    text-align: left;
    transition: background 0.14s ease;
}

.tm-config-modal .tm-custom-action-header:hover {
    background: #f8fbff;
}

.tm-config-modal .tm-custom-action-row.is-open .tm-custom-action-header {
    background: #f4f8ff;
}

.tm-config-modal .tm-custom-action-header-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 12px;
}

.tm-config-modal .tm-custom-action-chevron {
    font-size: 16px;
    line-height: 1;
    color: var(--tm-text-muted);
}

.tm-config-modal .tm-custom-action-body {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.tm-config-modal .tm-custom-action-row .tm-custom-action-content {
    min-height: 110px;
}

.tm-modal-footer {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 2px;
}

.tm-btn {
    border: 1px solid transparent;
    border-radius: var(--tm-radius-sm);
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    padding: 10px 12px;
    cursor: pointer;
    transition: all 0.14s ease;
}

.tm-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(39, 100, 255, 0.14);
}

.tm-btn-primary {
    background: var(--tm-primary);
    border-color: var(--tm-primary);
    color: #fff;
}

.tm-btn-primary:hover {
    background: var(--tm-primary-hover);
    border-color: var(--tm-primary-hover);
    transform: translateY(-1px);
}

.tm-btn-secondary {
    background: #ffffff;
    border-color: var(--tm-border-strong);
    color: var(--tm-text);
}

.tm-btn-secondary:hover {
    background: #f5f8fe;
    transform: translateY(-1px);
}

.tm-btn-danger {
    background: #fff4f4;
    border-color: #f1b4b4;
    color: var(--tm-danger);
}

.tm-btn-danger:hover {
    background: #ffecec;
}

#td-download-progress {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: min(380px, calc(100vw - 24px));
    background: var(--tm-surface);
    border: 1px solid var(--tm-border);
    border-radius: var(--tm-radius-md);
    box-shadow: var(--tm-shadow);
    padding: 12px;
    z-index: 2147483647;
    animation: tmPopIn 0.16s ease-out;
}

#td-download-progress .tm-download-title {
    font-weight: 700;
    margin-bottom: 8px;
}

#td-download-progress #td-download-status {
    margin-bottom: 8px;
    color: var(--tm-text-muted);
}

#td-download-progress .tm-download-track {
    background: #e8edf8;
    border-radius: 999px;
    overflow: hidden;
    height: 10px;
    margin-bottom: 8px;
}

#td-download-progress #td-download-bar {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #3874ff, #60a5ff);
    transition: width 0.15s ease;
}

#td-download-progress .tm-download-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

@keyframes tmFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes tmScaleIn {
    from {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.98);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
}

@keyframes tmPopIn {
    from {
        opacity: 0;
        transform: translateY(8px) scale(0.985);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}
`;
    const STORAGE_PREFIX = 'tmActionPanel';
    const STORAGE_KEY_COLLAPSED = STORAGE_PREFIX + 'Collapsed';

    let configuration;
    const config = {
        defaultPosition: {
            top: 120,
            left: 20
        },
        actions: [
            {
                label: 'Insert Greeting',
                class: 'half',
                action: () => {
                    let name = document.querySelector( '.panel-person-card .media .media-heading a' ).textContent ?? "";
                    name = name.split(' ')[0];
                    insertIntoEditor(`Hello ${name},\n\n`);
                },
                condition: ()=>{
                    return location.href.match( /update/i );
                }
            },
            {
                label: 'Insert Signature',
                class: 'half',
                action: () => {
                    insertIntoEditor(`${configuration.get('signature')}`);
                },
                condition: ()=>{
                    return location.href.match( /update/i );
                }
            },
            {
                label: 'Mark Resolved',
                action: () => {
                    document.querySelector('#NewStatusId').value = 132659;
                    document.querySelector('#TimeAccountId').value = 7313;
                    document.querySelector('#TimeHours').value = prompt( "Enter hours" );
                    document.querySelector('#CommentsIsPrivate').checked = false;
                },
                condition: ()=>{
                    return location.href.match( /update/i );
                }
            },
            {
                label: 'Respond',
                class: 'half',
                action: () => {
                    let name = document.querySelector( '.panel-person-card .media .media-heading a' ).textContent ?? "";
                    name = name.split(' ')[0];
                    insertIntoEditor(`Hello ${name},\n\n`);
                    let m = prompt( "Input what did sentence" );
                    insertIntoEditor(`${m} ${configuration.get('signature')}`);
                },
                condition: ()=>{
                    return location.href.match( /update/i );
                }
            },
            {
                label: 'Comment',
                action: () => {
                    let commentBtn = document.querySelector( '#btnComment' );
                    let name = document.querySelector( '.panel-person-card .media .media-heading a' ).textContent ?? "";
                    name = name.split(' ')[0];
                    let s = `Hello ${name},<br><br>`;
                    let m = prompt( "Input what did sentence" );
                    s += (`${m} ${configuration.get('signature')}`);
                    s = s.replace(/(?:\r\n|\r|\n)/g, '<br>');
                    showHideCommentInput(true, s );
                },
                condition: ()=>{
                    return location.href.match( /TicketDet/i );
                }
            },
            {
                label: 'Add Time',
                class: 'half',
                action: () => {
                    document.querySelector('#TimeAccountId').value = 7313;
                    let hours = prompt( "Enter hours" );
                    document.querySelector('#TimeHours').value = hours;
                    insertIntoEditor(`Adding ${hours} hour${hours>1?'s':''} to time tracking.`);
                    document.querySelector( '#btnSubmit' ).click()
                },
                condition: ()=>{
                    return location.href.match( /update/i );
                }
            },
            {
                label: 'Download All',
                action: () => {
                    let dls = [];
                    let title = document.querySelector( '#thTicket_spnTitle' ).textContent;
                    title = title.replaceAll( ' ', '-').replaceAll( /[<>:"\\/|\?\*]/g, '' );
                    document.querySelectorAll( "#divAttachments .media span a" ).forEach( ( i ) => { dls.push( { url: i.href, name: i.textContent.replaceAll( ' ', '-' )  } ) } );
                    console.log( dls );
                    downloadFiles( dls, `${title}.zip` );
                },
                condition: ()=>{
                    return location.href.match( /ticketdet/i );
                }
            },
            {
                label: 'New Ticket',
                action: ()=>{ location.href = "https://riversideca.teamdynamix.com/TDNext/Apps/2814/Tickets/New?formId=55995" }
            },
        ]
    };
    
    function init() {
        configuration = new Configuration();
        if( !configuration.load() ){
            configuration.displayModal();
        }
        injectStyle();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createPanel);
        } else {
            createPanel();
        }
    }

    function createRuntimeAction(customAction) {
        const label = (customAction?.label || '').trim();
        const mode = customAction?.mode === 'runJs' ? 'runJs' : 'insertText';
        const text = customAction?.text || '';
        const script = customAction?.script || '';

        if (!label) return null;
        if (mode === 'insertText' && !text) return null;
        if (mode === 'runJs' && !script) return null;

        const className = customAction.class === 'half' ? 'half' : undefined;
        const urlPattern = (customAction.urlPattern || '').trim();

        return {
            label,
            class: className,
            action: () => {
                if (mode === 'runJs') {
                    const runner = new Function('helpers', 'configuration', 'customAction', script);
                    runner({
                        insertIntoEditor,
                        insertHtmlIntoEditor,
                        downloadFiles,
                        location: window.location,
                        document: window.document,
                        window,
                        alert,
                        prompt,
                        console,
                        showHideCommentInput: window.showHideCommentInput
                    }, configuration, customAction);
                    return;
                }

                insertIntoEditor(text.replace(/\\n/g, '\n'));
            },
            condition: () => {
                if (!urlPattern) return true;
                try {
                    return new RegExp(urlPattern, 'i').test(location.href);
                } catch (error) {
                    console.warn('Invalid custom action URL pattern:', urlPattern, error);
                    return true;
                }
            }
        };
    }

    function getAllActions() {
        const custom = (configuration?.customActions || [])
            .map(createRuntimeAction)
            .filter(Boolean);

        return [...config.actions, ...custom];
    }

    function refreshPanel() {
        const existing = document.getElementById('tm-action-panel');
        if (existing) {
            existing.remove();
        }
        createPanel();
    }

    function injectStyle(){
        let id = "mr-teamdynamixStyles";
        if( !document.querySelector( `#${id}` ) ) {
            let elem = document.createElement( 'style' );
            elem.id = id;
            elem.textContent = STYLES;
            document.head.appendChild( elem );
        }
    }

    function generateLinkShortcuts(){
        document.querySelectorAll( "#divAttachments .media span a" ).forEach( ( e ) => {
            const out = e.closest('.media-body').querySelector('div:last-child');

            const a = document.createElement( 'a' );
            a.textContent = '⏬ Websafe';
            a.className = 'tm-websafe-dl';
            a.addEventListener( 'click', ()=>{
                downloadSingle( {url: e.href, name: e.textContent.replaceAll( ' ', '-' ) } )
            } );
            //if there is a link already dont run again
            if( out.querySelector( 'a.tm-websafe-dl') ) return;
            out.prepend( a );
        });
    }

    function createPanel() {
        setTimeout( generateLinkShortcuts, 1000 );
        if (document.getElementById('tm-action-panel')) return;

        const savedPosition = configuration.get('position');
        const isCollapsed = loadCollapsedState();

        const panel = document.createElement('div');
        panel.id = 'tm-action-panel';

        Object.assign(panel.style, {
            top: `${savedPosition.top}px`,
            left: `${savedPosition.left}px`,
        });

        const header = document.createElement('div');
        header.className = 'tm-header';

        const title = document.createElement('span');
        title.textContent = configuration.title;
        title.style.flex = '1';

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.textContent = isCollapsed ? '+' : '−';

        const configBtn =  document.createElement('button');
        configBtn.type = 'button';
        configBtn.textContent = '⚙';
        configBtn.title = 'Configure';

        const body = document.createElement('div');
        body.className = 'tm-actions'
        body.style.display = isCollapsed ? 'none' : 'flex';

        for (const item of getAllActions()) {
            let passCond = true;
            try {
                passCond = typeof item.condition === 'function' ? Boolean(item.condition()) : true;
            } catch (err) {
                console.error('Action condition threw:', err);
                passCond = true;
            }
            //skip if not good
            if( passCond ) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = item.label;
                btn.className = 'tm-action-btn';
                if (item.class) {
                    btn.classList.add(item.class);
                }

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
        }

        header.appendChild(title);
        header.appendChild(configBtn);
        header.appendChild(toggleButton);
        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);
        keepPanelInViewport(panel, false);

        toggleButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const collapsed = body.style.display === 'none';
            body.style.display = collapsed ? 'flex' : 'none';
            toggleButton.textContent = collapsed ? '−' : '+';
            saveCollapsedState(!collapsed);
        });

        configBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            //open modal to set name, default signature, etc.
            configuration.displayModal(refreshPanel);
        });

        let resizeTimer;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                keepPanelInViewport(panel, true);
            }, 50);
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

            configuration.set('position',{
                left: panel.offsetLeft,
                top: panel.offsetTop
            });
        }
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function keepPanelInViewport(panel, save = true) {
        if (!panel || !document.body.contains(panel)) return;

        const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

        const currentLeft = parseInt(panel.style.left, 10) || panel.offsetLeft || 0;
        const currentTop = parseInt(panel.style.top, 10) || panel.offsetTop || 0;

        const nextLeft = clamp(currentLeft, 0, maxLeft);
        const nextTop = clamp(currentTop, 0, maxTop);

        panel.style.left = `${nextLeft}px`;
        panel.style.top = `${nextTop}px`;

        if (save) {
            configuration.set('position',{
                left: nextLeft,
                top: nextTop
            });
        }
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


/** download logic */
async function downloadFiles( files, zipName, concurrency = 3) {
    zipName = zipName || 'attachments.zip';

    // Limit concurrency to reasonable value
    concurrency = Math.max(1, Math.min(concurrency || 3, 8));

    // simple progress UI
    const PROG_ID = 'td-download-progress';
    let prog = document.getElementById(PROG_ID);
    if (!prog) {
        prog = document.createElement('div');
        prog.id = PROG_ID;

        prog.innerHTML = `
            <div class="tm-download-title">Downloading files</div>
            <div id="td-download-status">Preparing...</div>
            <div class="tm-download-track">
                <div id="td-download-bar"></div>
            </div>
            <div class="tm-download-footer">
                <div id="td-download-percent">0%</div>
                <button id="td-download-close" class="tm-btn tm-btn-secondary">Close</button>
            </div>
        `;

        document.body.appendChild(prog);
    }

    const statusElem = document.getElementById('td-download-status');
    const barElem = document.getElementById('td-download-bar');
    const pctElem = document.getElementById('td-download-percent');
    const closeBtn = document.getElementById('td-download-close');

    if (!Array.isArray(files) || files.length === 0) {
        alert('No files to download.');
        prog.remove();
        return;
    }

    const zip = new JSZip();

    // Abort controller to cancel all fetches
    const abortController = new AbortController();
    let aborted = false;
    closeBtn.addEventListener('click', () => {
        aborted = true;
        try { abortController.abort(); } catch (e) {}
        statusElem.textContent = 'Canceled by user.';
        setTimeout(() => { try { prog.remove(); } catch {} }, 800);
    });

    let nextIndex = 0;
    let completed = 0;

    // worker to process queue
    const worker = async () => {
        while (true) {
            const i = nextIndex++;
            if (i >= files.length || aborted) break;

            const file = files[i];
            try {
                statusElem.textContent = `Downloading ${i + 1} of ${files.length}: ${file.name}`;
                const response = await fetch(file.url, { signal: abortController.signal });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} for ${file.url}`);
                }

                const blob = await response.blob();
                zip.file(file.name, blob);
            } catch (error) {
                if (error && error.name === 'AbortError') {
                    // aborted
                    break;
                }
                console.error(`Failed to fetch ${file.url}:`, error);
                zip.file(file.name + '.error.txt', `Failed to fetch ${file.url}: ${error && error.message ? error.message : String(error)}`);
            }

            completed++;
            const percent = Math.round((completed / files.length) * 100);
            barElem.style.width = percent + '%';
            pctElem.textContent = percent + '%';
        }
    };

    // start workers
    const workers = [];
    for (let w = 0; w < Math.min(concurrency, files.length); w++) {
        workers.push(worker());
    }

    // wait for downloads to finish
    try {
        await Promise.all(workers);
    } catch (err) {
        // ignore individual worker errors; already handled
    }

    if (aborted) {
        statusElem.textContent = 'Download canceled.';
        return;
    }

    // Zipping phase
    statusElem.textContent = 'Compressing files...';
    pctElem.textContent = '0%';

    try {
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }, (metadata) => {
            const pct = Math.round(metadata.percent);
            barElem.style.width = pct + '%';
            pctElem.textContent = pct + '%';
        });

        statusElem.textContent = 'Saving ZIP...';
        barElem.style.width = '100%';
        pctElem.textContent = '100%';

        saveAs(zipBlob, zipName);
    } catch (err) {
        console.error('Error generating zip:', err);
        statusElem.textContent = 'Error compressing files. See console.';
    } finally {
        setTimeout(() => {
            try { prog.remove(); } catch {};
        }, 1800);
    }
}


async function downloadSingle( file ){
    try{
        const res = await fetch( file.url );
        if( !res.ok ){
            throw new Error( `HTTP ${response.status} for ${file.url}` );
        }

        const blob = await res.blob();
        const objUrl = URL.createObjectURL( blob );
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = file.name;

        document.body.appendChild( link );
        link.click();

        document.body.removeChild( link );
        URL.revokeObjectURL( objUrl );
    } catch{
        window.open( file.url );
    }
}