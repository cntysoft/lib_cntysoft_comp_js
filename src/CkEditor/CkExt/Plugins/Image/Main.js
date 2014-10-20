/*
 * Cntysoft OpenEngine
 * 
 * @author SOFTBOY <cntysoft@163.com>
 * @author changwang <chenyongwang1104@163.com>
 * copyright  Copyright (c) 2010-2011 Cntysoft Technologies China Inc. <http://www.cntysoft.com>
 * license    http://www.cntysoft.com/license/new-bsd     New BSD License
 */
/**
 * 图片管理器， 支持上传
 */
Ext.define('Cntysoft.Component.CkEditor.CkExt.Plugins.Image.Main', {
    extend : 'Cntysoft.Component.CkEditor.CkExt.AbstractPlugin',
    hasStylesheet : true,
    toolbar : 'insert,1',
    constructor : function(config)
    {
        this.LANG_TEXT = Cntysoft.GET_COMP_LANG_TEXT('VENDER_EXT.CK.PLUGINS.IMAGE');
        this.applyLangText();
        this.callParent([config]);
        var allowed = 'img[alt,src]{border,border-style,border-width,float,height,padding,margin,margin-bottom,margin-left,margin-right,margin-top,width}',
        required = 'img[alt,src]';
        var command = this.editor.addCommand(this.name, this.getCommandObject({
            allowedContent : allowed,
            requiredContent : required,
            contentTransformations : [
                ['img{width}: sizeToStyle', 'img[width]: sizeToAttribute'],
                ['img{float}: alignmentToStyle', 'img[align]: alignmentToAttribute']
            ]
        }));
        command.modes = {wysiwyg : 1};
    },
    setupEditorInstance : function()
    {
        var me = this;
        this.editor.on('doubleclick', function(evt){
            var element = evt.data.element;
            if(element.is('img') && !element.data('cke-realelement') && !element.isReadOnly()){
                var dialog = me.getDialog();
                dialog.load(element);
                dialog.show();
            }
        });
    },
    getStylesheetText : function()
    {
        return [
            '.ck-cnt-plugin-image-img-align{cursor: pointer;}',
            '.ck-cnt-plugin-image-img-blur{opacity: 0.5;filter: alpha(opacity = 50);}',
            '.ck-cnt-plugin-image-img-focus{opacity: 1;filter: alpha(opacity = 100);}'
        ].join("\n");
    }
}); 