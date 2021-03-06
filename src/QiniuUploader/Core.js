/**
 * Cntysoft OpenEngine
 *
 * @author Changwang <chenyongwang1104@163.com>
 * copyright  Copyright (c) 2010-2011 Cntysoft Technologies China Inc. <http://www.cntysoft.com>
 * license    http://www.cntysoft.com/license/new-bsd     New BSD License
 */
/**
 * 整合百度flash上传器以及七牛云存储
 */
Ext.define('Cntysoft.Component.QiniuUploader.Core', {
   extend : 'Ext.Component',
   alias : 'widget.cmpqiniuuploadercore',
   requires : [
      'Cntysoft.Kernel.StdPath',
      'Cntysoft.Component.QiniuUploader.Lang.zh_CN',
      'Cntysoft.Component.QiniuUploader.ErrorHandler'
   ],
   mixins : {
      langTextProvider : 'Cntysoft.Mixin.LangTextProvider',
      callSys : 'Cntysoft.Mixin.CallSys'
   },
   /**
    * @inheritdoc
    */
   LANG_NAMESPACE : 'Cntysoft.Component.QiniuUploader.Lang',
   /**
    * 是否自动开始上传文件
    *
    * @cfg {Boolean} [autoStart=false]
    */
   autoStart : false,
   /**
    * 是否执行分片上传
    *
    * @cfg {Boolean} [chunked=true]
    */
   chunked : false,
   /**
    * 默认的按钮类名称
    *
    * @cfg {String} [buttonCls='cntysoft-comp-component-uploader']
    */
   cls : 'cntysoft-comp-component-uploader',
   /**
    * @cfg {Number} [height=24]
    */
   height : 32,
   /**
    * @cfg {Number} [width=80]
    */
   width : 85,
   /**
    * @readonly
    * @property {Number} fileSingleSizeLimit 上传文件大小， 这个由服务器端确定
    */
   fileSingleSizeLimit : null,
   /**
    * 队列中总文件数量
    *
    * @cfg {Number} [queueSizeLimit=100]
    */
   queueSizeLimit : 20,
   /**
    * 上传按钮文字
    *
    * @cfg {String} buttonText
    */
   buttonText : '',
   /**
    * 允许的文件类型，用','隔开
    *
    * @cfg {Array} fileTypeExts
    */
   fileTypeExts : ['gif', 'png', 'jpg', 'jpeg', 'txt', 'rar', 'zip', 'tar.gz', 'html'],
   /**
    * 文件类型判断的正则
    *
    * @private
    * @property {String} fileTypeRegex
    */
   fileTypeRegex : null,
   /**
    * 是否开启图片生成缩略图功能，只对上传文件为图片的时候起作用，默认为关闭状态
    *
    * @author Changwang <chenyongwang1104@163.com>
    * @property {Boolean} enableNail
    */
   enableNail : false,
   /**
    * 上传之后的图片名称
    *
    * @property {Boolean} targetName
    */
   targetName : null,
   /**
    * 是否允许多文件上传
    *
    * @cfg {Boolean} [multi=true]
    */
   multi : true,
   /**
    * 百度上传组建引用
    *
    * @property {WebUploader} webUploader
    */
   webUploader : null,
   /**
    * @protected
    * @property {Object} LANG_TEXT
    */
   LANG_TEXT : null,
   /**
    * 上传文件的大小限制, 默认为 2 单位 MB
    *
    *@property {int} maxSize
    */
   maxSize : 2,
   /**
    * 上传请求的URL地址
    *
    * @property {String} requestUrl
    */
   requestUrl : 'http://up.qiniu.com',
   /**
    * 出错信息对象， 支持处理多个错误
    *
    * @private
    * @property {String} queueErrorMsg
    */
   queueErrorMsg : '',
   /**
    *  获取Token信息所需的Meta 信息
    *
    *  **使用规范** ： 向服务器端获取Token默认是发送 callSys请求，可通过配置
    *    scriptName 和 upTokenMethod 来确定调用那个接口
    *
    *
    *  @property {String} null
    */
   upTokenMethod : 'getToken',
   /**
    *  获取上传Token的脚本名称
    *
    *  @property {String} null
    */
   scriptName : 'QiniuUploadHandler',
   /**
    * 七牛云存储上传的Token
    *
    *  @property {String} null
    */
   upToken : null,
   /**
    * 上传之后的路径分类
    */
   path : null,

   constructor : function(config)
   {
      config = config || {};
      this.mixins.langTextProvider.constructor.call(this);
      this.LANG_TEXT = this.GET_LANG_TEXT('CORE');
      this.applyConstraintConfig(config);
      this.callParent([config]);
      this.setupMaxSize();
   },
   /**
    * @param {Object} config
    */
   applyConstraintConfig : function(config)
   {
      Ext.apply(config,{
         buttonText : this.LANG_TEXT.BROWSE
      });
   },
   initComponent : function()
   {
      this.fileTypeRegex = this.fileTypeExts.join(',')
         .replace(/,/g, '|')
         .replace(/\*/g, '.*');
      this.fileTypeRegex = new RegExp(this.fileTypeRegex, 'i');
      this.callParent();
   },

   /**
    * 开始上传。此方法可以从初始状态调用开始上传流程，也可以从暂停状态调用，继续上传流程
    */
   startUpload : function()
   {
      if(this.webUploader){
         this.webUploader.upload();
      }
   },
   /**
    * 停止上传循环
    */
   stopUpload : function()
   {
      if(this.webUploader){
         this.webUploader.stop();
      }
   },
   /**
    * 取消队列的文件的上传循环
    */
   cancelUpload : function()
   {
      if(this.webUploader){
         var files = this.getFiles();
         var len = files.length;
         var file;
         var S = this.self.FILE_STATUS;
         var status;
         for(var i = 0; i < len; i++) {
            file = files[i];
            status = file.getStatus();
            if(status == S.INITED || status == S.QUEUED || status == S.PROGRESS){
               this.removeFile(file);
            }
         }
         if(this.hasListeners.cancelupload){
            this.fireEvent('cancelupload', this);
         }
      }
   },
   /**
    * 按照file对象或者fileid 删除上传队列里面的文件
    *
    * @param {String|Object} file
    */
   removeFile : function(file)
   {
      if(this.webUploader){
         this.webUploader.removeFile(file);
      }
   },
   /**
    * 返回指定状态的文件集合，不传参数将返回所有状态的文件。
    *
    * @return {Array}
    */
   getFiles : function()
   {
      if(this.webUploader){
         return this.webUploader.getFiles.apply(this.webUploader, arguments);
      }
      return array();
   },

   setupConst : function()
   {
      this.self.addStatics({
         /**
          * <code>
          * {
             *  INITED:     'inited',    // 初始状态
             *  QUEUED:     'queued',    // 已经进入队列, 等待上传
             *  PROGRESS:   'progress',    // 上传中
             *  ERROR:      'error',    // 上传出错，可重试
             *  COMPLETE:   'complete',    // 上传完成。
             *  CANCELLED:  'cancelled',    // 上传取消。
             *  INTERRUPT:  'interrupt',    // 上传中断，可续传。
             *  INVALID:    'invalid'    // 文件不合格，不能重试上传。
             *  };
          *  </code>
          */
         FILE_STATUS : WebUploader.File.Status
      });
   },
   /**
    * 设置上传的文件的文件名称
    *
    * @param {Boolean} flag
    * @return {Cntysoft.Component.Uploadify.Core}
    */
   setTargetName : function(targetName)
   {
      this.targetName = targetName;
      if(this.webUploader){
         this.applyConfigToUploader();
      }
      return this;
   },
   /**
    *
    */
   afterRender : function()
   {
      this.callParent();
      Ext.Loader.loadScript({
         url : [
            '/JsLibrary/Jquery/jquery-1.10.1.min.js',
            '/JsLibrary/WebUploader/webuploader.min.js'
         ],
         onLoad : function() {
            this.setupConst();
            this.getUpToken();
         },
         scope : this
      });
   },

   /**
    *  获取服务器端的七牛云上传Token
    */
   getUpToken : function()
   {
      this.callSys(this.upTokenMethod, {}, this.setupTokenHanler, this);
   },

   /**
    *  设置七牛云上传Token
    *
    *  **注意** : 返回的Json数据结构
    *
    *    {
    *       "data" : {
    *          "token" : "88888888888888"
    *       }
    *    }
    *
    *  @param {Object} response
    */
   setupTokenHanler : function(response)
   {
      if(!response.status) {
         Cntysoft.raiseError(Ext.getClassName(this), 'setupTokenHanler', 'get upload token error');
      }else {
         var data = response.data;
         this.upToken = data.token;
         this.wrapperWebUploader();
      }
   },
   /**
    * 加载百度上传器对象
    */
   wrapperWebUploader : function()
   {
      var cfg = this.getWebUploaderConfig();
      this.applyEventHandlers(cfg);
      this.webUploader = WebUploader.create(cfg);
      var picker = this.el.child('.webuploader-pick');
      var height = this.height;
      var width = this.width;
      picker.setStyle({
         height : height + 'px',
         lineHeight : height + 'px',
         width : width + 'px'
      });
      this.webUploader.on('uploadAccept', this.uploadAcceptHandler, this);
   },
   /**
    * 获取默认的Uploader配置对象
    *
    * @return {Object}
    */
   getWebUploaderConfig : function()
   {
      var STD_PATH = Cntysoft.Kernel.StdPath;
      var fileSingleSize = this.fileSingleSizeLimit = parseInt(this.maxSize) * 1024 * 1024;//单位默认为MB
      //这里是否需要包裹？
      var el = this.el;
      var targetId = '#' + el.id;
      return {
         auto : this.autoStart,
         pick : {
            id : targetId,
            label : this.buttonText,
            multiple : this.multi
         },
         // swf文件路径
         swf : STD_PATH.getVenderPath() + '/WebUploader/Uploader.swf',
         chunked : this.chunked,
         fileNumLimit : this.queueSizeLimit,
         accept : {
             extensions : this.fileTypeExts
         },
         fileSingleSizeLimit : fileSingleSize,
         server : this.requestUrl,
         formData : this.getUploadFormData(),
         compress : false//暂时压缩，这个特性把我害惨了，组件在这个地方有个小bug
      };
   },
   /**
    * 绑定一些默认的事件处理函数
    */
   applyEventHandlers : function(cfg)
   {
      Ext.apply(cfg, {
         onError : Ext.bind(this.errorHandler, this),
         onBeforeFileQueued : Ext.bind(this.beforeFileQueuedHandler, this),
         onFileQueued : Ext.bind(this.fileQueuedHandler, this),
         onFilesQueued : Ext.bind(this.filesQueuedHandler, this),
         onFileQueueError : Ext.bind(this.fileQueueErrorHandler, this),
         onFileDequeued : Ext.bind(this.fileDequeuedHandler, this),
         onUploadBeforeSend : Ext.bind(this.uploadBeforeSendHandler, this),
         onStartUpload : Ext.bind(this.startUploadHandler, this),
         onStopUpload : Ext.bind(this.stopUploadHandler, this),
         onUploadFinished : Ext.bind(this.uploadFinishedHandler, this),
         onUploadStart : Ext.bind(this.uploadStartHandler, this),
         onUploadProgress : Ext.bind(this.uploadProgressHandler, this),
         onUploadError : Ext.bind(this.uploadErrorHandler, this),
         onUploadSuccess : Ext.bind(this.uploadSuccessHandler, this),
         onUploadComplete : Ext.bind(this.uploadCompleteHandler, this)
      });
   },
   /**
    * 将配置信息传递到上传器中
    */
   applyConfigToUploader : function()
   {
      var options = this.webUploader.options;
      Ext.apply(options, {
         auto : this.autoStart,
         formData : this.getUploadFormData()
      });
   },

   /**
    *  获取上传的数据信息
    */
   getUploadFormData : function()
   {
      return {
         token : this.upToken
      };
   },

   /**
    * @template
    * @return {Number}
    */
   getUploadLimitSize : Ext.emptyFn,

   /**
    *
    * @returns {*}
    */
   setupMaxSize : function()
   {
      return Ext.Array.min([this.maxSize, this.getUploadLimitSize()]);
   },
   /**
    * 上传接受处理器
    */
   uploadAcceptHandler : function(block, ret, rejectFn)
   {
      if(!ret.status){
         if(ret.errorCode == 10008/*需要更多的分块*/){
            return true;
         } else{
            rejectFn(ret);
            return false;
         }
      } else{
         return true;
      }
   },
   /**
    * @param {Object} file 文件对象
    */
   beforeFileQueuedHandler : function(file)
   {
      //探测文件类型错误
      //webuploader在这里实现有问题
      if(!this.fileTypeRegex.test(file.name)){
         this.webUploader.trigger('fileQueueError', file, 'fileTypeError');
         return false;
      }
      if(this.hasListeners.beforefilequeued){
         return this.fireEvent('beforefilequeued', file, this);
      }
      return true;
   },
   /**
    * webuploader一些错误处理, 比如队列长度溢出，单个文件大小溢出等等
    */
   errorHandler : function(type)
   {
      this.fileQueueErrorHandler(null, type);
   },
   /**
    * 文件加入队列之前错误探测
    *
    * @param {Object} file 文件对象
    * @param {String} errorType 错误类型
    */
   fileQueueErrorHandler : function(file, errorType)
   {
      var errorMap = this.LANG_TEXT.ERROR_MSG;
      if(errorType == 'emptyFileError'){
         this.queueErrorMsg += Ext.String.format(errorMap.ZERO_BYTE_FILE, file.name) + '</br>';
      } else if(errorType == 'fileTypeError'){
         this.queueErrorMsg += Ext.String.format(errorMap.INVALID_FILETYPE, file.name, this.fileTypeExts) + '</br>';
      } else if(errorType == 'exceed_size'){
         this.queueErrorMsg += Ext.String.format(errorMap.FILE_EXCEEDS_SIZE_LIMIT, file.name, this.maxSize) + '</br>';
      } else if(errorType == 'Q_EXCEED_NUM_LIMIT'){
         this.queueErrorMsg += Ext.String.format(errorMap.QUEUE_LIMIT_EXCEEDED, this.queueSizeLimit) + '</br>';
      } else{
         this.queueErrorMsg += errorMap.UNKNOW + '</br>';
      }
   },
   /**
    * 当单个文件超过文件限制的时候，webuploader没有触发事件，唉，为什么这样设计啊
    * 我们在这里进行相关处理
    *
    * @param {Object} file 文件对象
    */
   fileQueuedHandler : function(file)
   {
      if(file.getStatus() !== this.self.FILE_STATUS.INVALID){
         if(this.hasListeners.filequeued){
            this.fireEvent('filequeued', file, this);
         }
      } else{
         this.fileQueueErrorHandler(file, file.statusText);
      }
   },
   /**
    * @param {Object[]} files
    */
   filesQueuedHandler : function(files)
   {
      if(this.queueErrorMsg.length > 0){
         if(this.hasListeners.filequeuederror){
            this.fireEvent('filequeuederror', this.queueErrorMsg, this);
         }
         this.queueErrorMsg = '';
      }else{
         if(this.hasListeners.filesqueued){
            this.fireEvent('filesqueued', files, this);
         }
      }
   },
   /**
    * @param {Object} file 文件对象
    */
   fileDequeuedHandler : function(file)
   {
      if(this.hasListeners.filedequeued){
         this.fireEvent('filedequeued', file, this);
      }
   },

   /**
    *  这个事件是为了配合七牛云的服务器，在每个文件分片上传的时候修改一些必要的参数以及Headers头信息
    *
    *
    * @param {Object} obj
    * @param {Object} data
    * @param {Object}  headers
    */
   uploadBeforeSendHandler : function(obj, data, headers)
   {
      //云存储的路径规则： /shop1/Shop/xxx.jpg
      var uniqid = this.getUniqid();
      var key = this.path + '/' + uniqid +'_' +data.name;
      data["key"] = key;
      if(this.hasListeners.uploadbeforesend){
         this.fireEvent('uploadbeforesend', obj, data, headers, this);
      }
   },

   /**
    *  生成唯一的识别ID
    *
    * @returns {string}
    */
   getUniqid : function()
   {
      return Math.random().toString(36).substr(2);
   },

   /**
    * 开始整个上传周期事件处理
    */
   startUploadHandler : function()
   {
      if(this.hasListeners.startupload){
         this.fireEvent('startupload', this);
      }
   },
   /**
    * 暂停上传处理函数
    */
   stopUploadHandler : function()
   {
      if(this.hasListeners.stopupload){
         this.fireEvent('stopupload', this);
      }
   },
   /**
    * 单个上传周期开始时间
    */
   uploadStartHandler : function(file)
   {
      if(this.hasListeners.uploadstart){
         this.fireEvent('uploadstart', file, this);
      }
   },
   /**
    * 我们在这里清除队列
    */
   uploadFinishedHandler : function()
   {
      if(this.hasListeners.uploadfinished){
         this.fireEvent('uploadfinished', this);
      }
   },
   /**
    * @param  {Object} File对象
    * @param {Number} percentage上传进度
    */
   uploadProgressHandler : function(file, percentage)
   {
      if(this.hasListeners.uploadprogress){
         this.fireEvent('uploadprogress', file, percentage, this);
      }
   },
   /**
    * @param {Object} file File对象
    */
   uploadSuccessHandler : function(file, response)
   {
      if(this.hasListeners.uploadsuccess){
         this.fireEvent('uploadsuccess', file, response.data, this);
      }
   },
   /**
    * @param {Object} file File对象
    * @param {Object} reason
    */
   uploadErrorHandler : function(file, reason, status)
   {
      if(this.hasListeners.uploaderror){
         this.fireEvent('uploaderror', file, reason, status, this);
      }
   },
   /**
    * @param {Object} file File对象
    */
   uploadCompleteHandler : function(file)
   {
      this.removeFile(file);
      if(this.hasListeners.uploadcomplete){
         this.fireEvent('uploadcomplete', file, this);
      }
   },
   destroy : function()
   {
      delete this.webUploader;
      this.callParent();
   }
});

