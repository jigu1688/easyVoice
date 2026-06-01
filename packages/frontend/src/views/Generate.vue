<template>
  <div class="novel-to-audio-container">
    <div class="header">
      <h1>文本转语音</h1>
      <p class="subtitle">将您的文本一键转换为自然流畅的语音</p>
    </div>

    <!-- 模式选择及全局设置 -->
    <div class="mode-selector-wrapper">
      <el-radio-group v-model="dubbingMode" size="large">
        <el-radio-button label="single">单人配音</el-radio-button>
        <el-radio-button label="multi">多角色配音</el-radio-button>
      </el-radio-group>
      <el-button 
        type="primary" 
        size="large" 
        :icon="Setting" 
        circle 
        class="global-settings-btn"
        @click="showAiSettingsDialog = true"
        title="AI 全局设置"
      />
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <!-- 单人配音输入卡片 -->
        <el-card class="input-card" v-if="dubbingMode === 'single'">
          <template #header>
            <div class="card-header">
              <span>文本输入</span>
              <el-button type="primary" size="small" @click="clearText">清空</el-button>
            </div>
          </template>
          <el-input
            v-model="audioConfig.inputText"
            type="textarea"
            placeholder="请输入或粘贴文本"
            :rows="12"
            resize="none"
          />
          <div class="upload-area">
            <el-upload
              drag
              action="#"
              :auto-upload="false"
              :on-change="handleFile"
              :show-file-list="false"
              accept=".txt"
            >
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">拖拽文件到此处或 <em>点击上传</em></div>
              <template #tip>
                <div class="el-upload__tip">支持 .txt 文本文件</div>
              </template>
            </el-upload>
          </div>
        </el-card>

        <!-- 多角色配音输入与分段展示卡片 -->
        <el-card class="input-card" v-else>
          <template #header>
            <div class="card-header">
              <span>多角色文本输入与解析</span>
              <el-button v-if="parsedSegments.length > 0" type="warning" size="small" @click="reParse">重新解析</el-button>
              <el-button v-else type="danger" size="small" @click="clearText">清空</el-button>
            </div>
          </template>

          <div v-if="parsedSegments.length === 0">
            <el-input
              v-model="audioConfig.inputText"
              type="textarea"
              placeholder="请输入或粘贴包含多角色对话的小说文本，例如：&#10;徐凤年笑道：“这可由不得你。”&#10;姜泥哼了一声：“我不去。”"
              :rows="12"
              resize="none"
            />
            <div class="upload-area">
              <el-upload
                drag
                action="#"
                :auto-upload="false"
                :on-change="handleFile"
                :show-file-list="false"
                accept=".txt"
              >
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text">拖拽文件到此处或 <em>点击上传</em></div>
                <template #tip>
                  <div class="el-upload__tip">支持 .txt 文本文件</div>
                </template>
              </el-upload>
            </div>
            
            <div class="parser-control-area">
              <div class="parser-mode-select">
                <span class="label">解析方式：</span>
                <el-radio-group v-model="parseMode" size="default">
                  <el-radio-button label="rule">规则快速解析</el-radio-button>
                  <el-radio-button label="ai">AI 智能解析</el-radio-button>
                </el-radio-group>
              </div>
              
              <div v-if="parseMode === 'ai'" class="ai-parse-tip">
                <span>当前模型: <el-tag size="small" type="info">{{ audioConfig.openaiModel || '默认(环境模型)' }}</el-tag></span>
                <el-button type="primary" link size="small" :icon="Setting" @click="showAiSettingsDialog = true" style="margin-left: 10px;">修改配置</el-button>
              </div>
              
              <el-button 
                type="success" 
                size="large" 
                @click="parseTextSegments" 
                :loading="parsing"
                :disabled="!audioConfig.inputText.trim()"
                style="margin-top: 15px; width: 100%;"
              >
                解析文本角色
              </el-button>
            </div>
          </div>

          <!-- 解析后的段落卡片列表 -->
          <div v-else class="parsed-content-area">
            <div class="segment-list-container">
              <div 
                v-for="(seg, idx) in parsedSegments" 
                :key="seg.id" 
                class="segment-item-card"
              >
                <div class="segment-card-meta">
                  <!-- 可切换/创建角色的下拉菜单 -->
                  <el-select
                    v-model="seg.charactor"
                    placeholder="选择角色"
                    size="small"
                    filterable
                    allow-create
                    default-first-option
                    class="role-select-badge"
                    @change="(val: string) => handleRoleChange(seg, val)"
                  >
                    <el-option
                      v-for="(_, charName) in characterMap"
                      :key="charName"
                      :label="String(charName)"
                      :value="String(charName)"
                    />
                  </el-select>
                  
                  <span class="index-label">#{{ idx + 1 }}</span>
                </div>
                
                <!-- 文本编辑区 -->
                <div class="segment-card-body-wrapper">
                  <div v-if="editingSegmentId === seg.id" class="editing-wrapper">
                    <el-input
                      v-model="editingText"
                      type="textarea"
                      :rows="3"
                      size="default"
                      placeholder="请输入配音文本内容..."
                      class="editing-textarea"
                    />
                    <div class="editing-controls">
                      <el-button 
                        size="small" 
                        type="success" 
                        :icon="Check" 
                        circle 
                        @click="saveEditing(seg)"
                      />
                      <el-button 
                        size="small" 
                        type="info" 
                        :icon="Close" 
                        circle 
                        @click="cancelEditing"
                      />
                    </div>
                  </div>
                  <div 
                    v-else 
                    class="segment-card-body" 
                    title="点击文本或右侧铅笔即可编辑"
                    @click="startEditing(seg)"
                  >
                    {{ seg.text || '(空文本)' }}
                    <el-icon class="inline-edit-icon"><Edit /></el-icon>
                  </div>
                </div>

                <!-- 动作面板：试听、上移、下移、插入、删除 -->
                <div class="segment-card-actions" v-if="editingSegmentId !== seg.id">
                  <el-button 
                    circle 
                    size="small" 
                    type="primary"
                    :icon="Service" 
                    title="单句试听"
                    @click="previewSegmentAudio(seg)"
                    :loading="segmentPreviewLoading[seg.id]"
                    :disabled="editingSegmentId === seg.id"
                  />
                  <el-button 
                    circle 
                    size="small" 
                    type="default"
                    :icon="ArrowUp" 
                    title="上移"
                    :disabled="idx === 0"
                    @click="moveSegment(idx, 'up')"
                  />
                  <el-button 
                    circle 
                    size="small" 
                    type="default"
                    :icon="ArrowDown" 
                    title="下移"
                    :disabled="idx === parsedSegments.length - 1"
                    @click="moveSegment(idx, 'down')"
                  />
                  <el-button 
                    circle 
                    size="small" 
                    type="success"
                    :icon="Plus" 
                    title="在此段后插入新段落"
                    @click="insertSegmentAfter(idx)"
                  />
                  <el-button 
                    circle 
                    size="small" 
                    type="danger"
                    :icon="Delete" 
                    title="删除此段"
                    @click="deleteSegment(idx)"
                  />
                </div>
              </div>
              
              <!-- 列表底部：新增段落按钮 -->
              <div class="add-segment-btn-wrapper">
                <el-button 
                  type="success" 
                  plain 
                  style="width: 100%" 
                  :icon="Plus" 
                  @click="addSegmentAtEnd"
                >
                  添加新分段
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：语音设置和控制 -->
      <el-col :span="8">
        <!-- 单人配音设置 -->
        <el-card class="settings-card" v-if="dubbingMode === 'single'">
          <template #header>
            <div class="card-header">
              <span>语音设置</span>
            </div>
          </template>

          <!-- 语音选择模式切换 -->
          <div class="voice-mode-selector">
            <el-radio-group v-model="audioConfig.voiceMode" size="large">
              <el-radio-button label="preset">预设语音</el-radio-button>
              <el-tooltip
                content="通过AI推荐不同的角色语音！(实验性功能，结果取决于模型能力！)"
                placement="top"
                effect="light"
              >
                <el-radio-button label="ai">
                  AI 推荐
                  <Sparkles class="sparkles-icon" :size="24" :stroke-width="1.25" />
                </el-radio-button>
              </el-tooltip>
            </el-radio-group>
          </div>

          <!-- 预设语音选择 -->
          <div v-if="audioConfig.voiceMode === 'preset'" class="voice-selector">
            <el-form label-position="top" size="default">
              <el-form-item label="语言">
                <el-select
                  v-model="audioConfig.selectedLanguage"
                  placeholder="选择语言"
                  @change="filterVoices"
                >
                  <el-option
                    v-for="lang in languages"
                    :key="lang.code"
                    :label="lang.name"
                    :value="lang.code"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="性别">
                <el-select
                  v-model="audioConfig.selectedGender"
                  placeholder="选择性别"
                  @change="filterVoices"
                >
                  <el-option label="全部" value="All" />
                  <el-option label="男性" value="Male" />
                  <el-option label="女性" value="Female" />
                </el-select>
              </el-form-item>

              <el-form-item label="配音员">
                <div v-if="audioConfig.selectedVoice" class="selected-voice-preview-card" @click="openVoiceMarket('single')">
                  <div 
                    class="voice-avatar" 
                    :style="{ background: getVoiceAvatarBg(audioConfig.selectedVoice) }"
                  >
                    {{ getVoiceInitial(audioConfig.selectedVoice) }}
                  </div>
                  <div class="voice-info">
                    <div class="voice-name-row">
                      <span class="voice-cn-name">{{ getCleanVoiceName(audioConfig.selectedVoice) }}</span>
                      <el-tag 
                        size="small" 
                        :type="getVoiceGenderType(audioConfig.selectedVoice)"
                        class="gender-tag"
                      >
                        {{ getVoiceGenderName(audioConfig.selectedVoice) }}
                      </el-tag>
                    </div>
                    <div class="voice-tags-row">
                      <span 
                        v-for="tag in getVoiceTags(audioConfig.selectedVoice)" 
                        :key="tag" 
                        class="mini-tag"
                      >
                        {{ tag }}
                      </span>
                    </div>
                  </div>
                  <el-button 
                    type="primary" 
                    size="small" 
                    link 
                    class="change-voice-link-btn"
                  >
                    更换
                  </el-button>
                </div>
                <el-button v-else type="primary" plain style="width: 100%" @click="openVoiceMarket('single')">
                  选择配音员
                </el-button>
              </el-form-item>

              <el-form-item label="语速">
                <el-slider
                  v-model="audioConfig.rate"
                  :min="-99"
                  :max="99"
                  :format-tooltip="formatRate"
                />
              </el-form-item>

              <el-form-item label="音量">
                <el-slider
                  v-model="audioConfig.volume"
                  :min="-99"
                  :max="99"
                  :format-tooltip="formatVolume"
                />
              </el-form-item>
              <el-form-item label="音调">
                <el-slider
                  v-model="audioConfig.pitch"
                  :min="-99"
                  :max="99"
                  :format-tooltip="formatPitch"
                />
              </el-form-item>
            </el-form>
          </div>

          <div v-else class="ai-mode-status-card">
            <div class="status-content">
              <Sparkles class="ai-sparkles-icon" :size="32" style="color: #409eff; margin-bottom: 10px;" />
              <h4>AI 智能推荐模式已启用</h4>
              <p>系统将调用大模型，为您的小说文本推荐最佳的语气和配音角色。</p>
              <div class="config-tip">
                <div>接口地址: <span class="tag">{{ audioConfig.openaiBaseUrl || '默认(环境变量)' }}</span></div>
                <div>所用模型: <span class="tag">{{ audioConfig.openaiModel || '默认(环境模型)' }}</span></div>
              </div>
              <el-button type="primary" plain size="small" :icon="Setting" @click="showAiSettingsDialog = true">
                修改 AI 配置
              </el-button>
            </div>
          </div>

          <div class="preview-section">
            <el-form-item label="试听文本">
              <el-input
                v-model="audioConfig.previewText"
                placeholder="输入短文本进行试听"
                :disabled="!canPreview"
              />
            </el-form-item>
            <el-button
              type="primary"
              @click="previewAudio"
              :disabled="!canPreview || previewLoading"
              :loading="previewLoading"
              :icon="Service"
            >
              试听
            </el-button>
            <audio
              ref="audioPlayer"
              v-show="audioConfig.previewAudioUrl"
              controls="false"
              class="preview-audio"
              :src="audioConfig.previewAudioUrl"
            ></audio>
          </div>
        </el-card>

        <!-- 多角色配音：角色发音配置面板 -->
        <el-card class="settings-card" v-else>
          <template #header>
            <div class="card-header">
              <span>角色声音配置</span>
            </div>
          </template>

          <div v-if="parsedSegments.length === 0" class="empty-settings-tip">
            <el-empty description="请先在左侧输入并解析文本以提取角色" :image-size="80" />
          </div>

          <div v-else class="character-settings-area">
            <p class="section-subtitle">为每个提取出的角色指定不同的发音配置：</p>
            <el-collapse accordion>
              <el-collapse-item 
                v-for="(config, char) in characterMap" 
                :key="char" 
                :name="char"
              >
                <template #title>
                  <div class="character-collapse-title">
                    <span 
                      class="role-badge" 
                      :style="{ backgroundColor: getCharacterColor(char as string) }"
                    >
                      {{ char }}
                    </span>
                    <span class="selected-voice-name">
                      {{ getVoiceCnName(config.voice) }}
                    </span>
                  </div>
                </template>

                <el-form label-position="top" size="small" style="padding: 10px;">
                  <el-form-item label="配音员">
                    <div v-if="config.voice" class="selected-voice-preview-card mini" @click="openVoiceMarket(char as string)">
                      <div 
                        class="voice-avatar mini" 
                        :style="{ background: getVoiceAvatarBg(config.voice) }"
                      >
                        {{ getVoiceInitial(config.voice) }}
                      </div>
                      <div class="voice-info">
                        <div class="voice-name-row">
                          <span class="voice-cn-name">{{ getCleanVoiceName(config.voice) }}</span>
                        </div>
                      </div>
                      <el-button 
                        type="primary" 
                        size="small" 
                        link 
                        class="change-voice-link-btn"
                      >
                        更换
                      </el-button>
                    </div>
                    <el-button v-else type="primary" plain style="width: 100%" @click="openVoiceMarket(char as string)">
                      选择配音员
                    </el-button>
                  </el-form-item>

                  <el-form-item label="语速">
                    <el-slider
                      v-model="config.rate"
                      :min="-99"
                      :max="99"
                      :format-tooltip="formatRate"
                    />
                  </el-form-item>

                  <el-form-item label="音量">
                    <el-slider
                      v-model="config.volume"
                      :min="-99"
                      :max="99"
                      :format-tooltip="formatVolume"
                    />
                  </el-form-item>

                  <el-form-item label="音调">
                    <el-slider
                      v-model="config.pitch"
                      :min="-99"
                      :max="99"
                      :format-tooltip="formatPitch"
                    />
                  </el-form-item>
                </el-form>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="action-area">
      <el-button
        v-if="dubbingMode === 'single'"
        type="primary"
        size="large"
        @click="handleGenerate"
        :loading="generating"
        :disabled="!canGenerate"
      >
        生成语音
      </el-button>
      <el-button
        v-else
        type="primary"
        size="large"
        @click="generateMultiAudioTask"
        :loading="generating"
        :disabled="parsedSegments.length === 0"
      >
        生成多人语音
      </el-button>
      <el-button :disabled="generating" type="danger" size="large" @click="reset">
        重置配置
      </el-button>
    </div>
    <div class="progress-bar">
      <el-progress
        v-if="generating"
        style="margin: 0px auto; max-width: 400px"
        :stroke-width="12"
        :percentage="generationStore.progress"
        :color="customColors"
      />
    </div>
    <StreamButton
      ref="audioPlayerRef"
      v-if="showStreamButton"
      :duration="streamDuration"
      @close="handleClose"
    />
    <DownloadList />

    <!-- AI 全局配置对话框 -->
    <el-dialog
      v-model="showAiSettingsDialog"
      title="AI 全局设置"
      width="500px"
      destroy-on-close
      class="custom-settings-dialog"
    >
      <el-form label-position="top">
        <el-form-item label="AI 服务商">
          <el-select v-model="aiProvider" placeholder="选择预设服务商" style="width: 100%">
            <el-option
              v-for="p in providerOptions"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="API 接口基础 URL (Base URL)">
          <el-input
            v-model="audioConfig.openaiBaseUrl"
            clearable
            placeholder="https://api.openai.com/v1"
          />
        </el-form-item>

        <el-form-item label="API Key">
          <el-input
            v-model="audioConfig.openaiKey"
            type="password"
            show-password
            clearable
            placeholder="请输入 API 密钥"
          />
        </el-form-item>

        <el-form-item label="大模型名称 (Model Name)">
          <el-select
            v-model="audioConfig.openaiModel"
            placeholder="选择或输入模型名称"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option
              v-for="model in (aiProvider === 'custom' ? modelOptions.map(o => o.value) : providerModels)"
              :key="model"
              :label="model"
              :value="model"
            />
          </el-select>
        </el-form-item>

        <el-divider>TTS 引擎配置</el-divider>

        <el-form-item label="TTS 服务商">
          <el-select v-model="audioConfig.ttsProvider" placeholder="选择 TTS 服务商" style="width: 100%">
            <el-option label="免费 Edge-TTS (内置/免Key)" value="edge" />
            <el-option label="微软 Azure TTS (收费版)" value="azure" />
            <el-option label="OpenAI TTS (官方/收费)" value="openai" />
          </el-select>
        </el-form-item>

        <template v-if="audioConfig.ttsProvider === 'azure'">
          <el-form-item label="Azure API Key (订阅密钥)">
            <el-input
              v-model="audioConfig.azureKey"
              type="password"
              show-password
              clearable
              placeholder="请输入 Azure TTS 订阅密钥"
            />
          </el-form-item>
          <el-form-item label="Azure Region (服务区域)">
            <el-input
              v-model="audioConfig.azureRegion"
              clearable
              placeholder="例如: eastasia, eastus"
            />
          </el-form-item>
        </template>

        <template v-if="audioConfig.ttsProvider === 'openai'">
          <el-form-item label="OpenAI API Key (语音专用)">
            <el-input
              v-model="audioConfig.openaiTtsKey"
              type="password"
              show-password
              clearable
              placeholder="若为空则默认使用上方的 AI 全局密钥"
            />
          </el-form-item>
          <el-form-item label="OpenAI Base URL (语音专用)">
            <el-input
              v-model="audioConfig.openaiTtsBaseUrl"
              clearable
              placeholder="例如: https://api.openai.com/v1（支持中转代理）"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="showAiSettingsDialog = false">确 定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 可视化声音馆对话框 -->
    <el-dialog
      v-model="showVoiceMarketDialog"
      title="可视化配音选择大厅"
      width="780px"
      destroy-on-close
      class="voice-market-dialog"
    >
      <div class="voice-market-header">
        <el-input
          v-model="marketSearchQuery"
          placeholder="搜索配音员名字或性格标签（例如：云希、温暖、活泼...）"
          clearable
          :prefix-icon="Search"
          class="market-search-bar"
        />
        
        <div class="market-filters">
          <div class="filter-group">
            <span class="filter-label">分类：</span>
            <el-radio-group v-model="marketCategory" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="novel">小说配音</el-radio-button>
              <el-radio-button label="news">新闻播报</el-radio-button>
              <el-radio-button label="cartoon">动漫卡通</el-radio-button>
              <el-radio-button label="dialect">地方方言</el-radio-button>
              <el-radio-button label="english">英文语音</el-radio-button>
            </el-radio-group>
          </div>
          
          <div class="filter-group">
            <span class="filter-label">性别：</span>
            <el-radio-group v-model="marketGender" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="Female">女声</el-radio-button>
              <el-radio-button label="Male">男声</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </div>
      
      <div class="voice-market-grid-container">
        <el-empty 
          v-if="filteredMarketVoices.length === 0" 
          description="未找到符合条件的配音员" 
          :image-size="80" 
        />
        
        <div v-else class="voice-market-grid">
          <div 
            v-for="voice in filteredMarketVoices" 
            :key="voice.Name"
            class="voice-market-card"
            :class="{ active: isVoiceSelected(voice.Name) }"
          >
            <div 
              class="card-avatar"
              :style="{ background: getVoiceAvatarBg(voice.Name) }"
            >
              {{ getVoiceInitial(voice.Name) }}
            </div>
            
            <div class="card-content">
              <div class="card-title-row">
                <span class="card-cn-name">{{ getCleanVoiceName(voice.Name) }}</span>
                <el-tag 
                  size="small" 
                  :type="getVoiceGenderType(voice.Name)"
                  class="card-gender-tag"
                >
                  {{ getVoiceGenderName(voice.Name) }}
                </el-tag>
              </div>
              <div class="card-technical-id">{{ voice.Name }}</div>
              
              <div class="card-tags-row">
                <span 
                  v-for="tag in getVoiceTags(voice.Name)" 
                  :key="tag" 
                  class="mini-tag"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            
            <div class="card-footer-actions">
              <!-- 试听按钮 -->
              <el-button 
                circle
                size="default"
                :type="previewPlayingVoice === voice.Name ? 'danger' : 'primary'"
                :icon="previewLoadingVoice === voice.Name ? Loading : (previewPlayingVoice === voice.Name ? VideoPause : VideoPlay)"
                @click="toggleVoicePreview(voice)"
                :loading="previewLoadingVoice === voice.Name"
                title="试听样品"
              />
              
              <!-- 选择按钮 -->
              <el-button 
                type="success"
                size="small"
                @click="selectVoiceFromMarket(voice.Name)"
              >
                使用
              </el-button>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeVoiceMarket">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { AxiosError } from 'axios'
import { Sparkles } from 'lucide-vue-next'
import { ref, computed, onMounted, watch, onBeforeMount, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useGenerationStore } from '@/stores/generation'
import { UploadFilled, Service, Setting, ArrowUp, ArrowDown, Plus, Delete, Edit, Check, Close, Search, VideoPlay, VideoPause, Loading } from '@element-plus/icons-vue'
import {
  asyncSleep,
  createAudioStreamProcessor,
  mapZHVoiceName,
  mockProgress,
  toFixed,
} from '@/utils'
import confetti from 'canvas-confetti'
import { useAudioConfigStore, type AudioConfig } from '@/stores/audioConfig'
import { defaultVoiceList, previewTextSelect } from '@/constants/voice'
import DownloadList from '@/components/DownloadList.vue'
import Notification from '@/assets/notification.mp3'
import StreamButton from '@/components/StreamButton.vue'
import {
  generateTTS,
  getVoiceList,
  type Voice,
  type GenerateResponse,
  createTaskStream,
  parseText,
  generateJsonStream,
} from '@/api/tts'
import { parseTextByRules } from '@/utils/parser'

const generationStore = useGenerationStore()
const configStore = useAudioConfigStore()
const { audioConfig } = configStore

const dubbingMode = ref<'single' | 'multi'>('single')
const parseMode = ref<'rule' | 'ai'>('rule')
const parsing = ref(false)
const parsedSegments = ref<{ id: string, charactor: string, text: string }[]>([])
const characterMap = ref<Record<string, { voice: string, rate: number, volume: number, pitch: number }>>({})
const segmentPreviewLoading = ref<Record<string, boolean>>({})

// Segment editing and management states
const editingSegmentId = ref<string | null>(null)
const editingText = ref<string>('')

// Voice Market (声音馆) states
const showVoiceMarketDialog = ref(false)
const voiceMarketTarget = ref<'single' | string>('single')
const marketSearchQuery = ref('')
const marketCategory = ref('all')
const marketGender = ref('all')
const previewPlayingVoice = ref<string | null>(null)
const previewLoadingVoice = ref<string | null>(null)
const previewAudioRef = ref<HTMLAudioElement | null>(null)
const previewCache = ref<Record<string, string>>({})

const showAiSettingsDialog = ref(false)
const aiProvider = ref('custom')
const providerOptions = [
  { label: 'DeepSeek 官方', value: 'deepseek', url: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { label: '智谱 AI (Zhipu)', value: 'zhipu', url: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4-plus', 'glm-4-air'] },
  { label: 'OpenAI 官方', value: 'openai', url: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o'] },
  { label: '小米 MIMO', value: 'mimo', url: 'https://api.mimo.miui.com/v1', models: ['mimo-v1'] },
  { label: '自定义 / 兼容接口', value: 'custom', url: '', models: [] }
]

const modelOptions = [
  { label: 'gpt-4o', value: 'gpt-4o' },
  { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
  { label: 'deepseek-chat', value: 'deepseek-chat' },
  { label: 'deepseek-reasoner', value: 'deepseek-reasoner' },
  { label: 'claude-3-5-sonnet-20241022', value: 'claude-3-5-sonnet-20241022' },
  { label: 'gemini-1.5-pro', value: 'gemini-1.5-pro' },
]

const providerModels = ref<string[]>([])

watch(aiProvider, (newVal) => {
  const provider = providerOptions.find(p => p.value === newVal)
  if (provider) {
    if (newVal !== 'custom') {
      audioConfig.openaiBaseUrl = provider.url
      providerModels.value = provider.models
      if (provider.models.length > 0) {
        audioConfig.openaiModel = provider.models[0]
      }
    } else {
      providerModels.value = []
    }
  }
})

const detectProvider = () => {
  const currentUrl = audioConfig.openaiBaseUrl
  if (!currentUrl) {
    aiProvider.value = 'custom'
    providerModels.value = []
    return
  }
  const matched = providerOptions.find(p => p.value !== 'custom' && currentUrl.includes(p.url))
  if (matched) {
    aiProvider.value = matched.value
    providerModels.value = matched.models
  } else {
    aiProvider.value = 'custom'
    providerModels.value = []
  }
}

watch(showAiSettingsDialog, (newVal) => {
  if (newVal) {
    detectProvider()
  }
})

const streamDuration = ref<number>(0)

const generating = ref(false)
const previewLoading = ref(false)
const showStreamButton = ref(false)

const successAudio = ref<HTMLAudioElement>()
const audioPlayer = ref<HTMLAudioElement>()
const confettiElement = ref<HTMLElement | null>(null)

const voiceList = ref<Voice[]>(defaultVoiceList)
const audioPlayerRef = ref<InstanceType<typeof StreamButton> | null>(null)
const processor = ref<ReturnType<typeof createAudioStreamProcessor> | null>(null)

const languages = ref([
  { code: 'zh-CN', name: '中文（简体）' },
  { code: 'zh-TW', name: '中文（繁体）' },
  { code: 'zh-HK', name: '中文（香港）' },
  { code: 'en-US', name: '英语（美国）' },
  { code: 'en-GB', name: '英语（英国）' },
  { code: 'en-AU', name: '英语（澳大利亚）' },
  { code: 'en-CA', name: '英语（加拿大）' },
])
const customColors = [
  { color: '#f5222d', percentage: 10 }, // 红色 (开始/较低)
  { color: '#fa541c', percentage: 20 }, // 橘红
  { color: '#fa8c16', percentage: 30 }, // 橘黄
  { color: '#fadb14', percentage: 40 }, // 黄色
  { color: '#fadb14', percentage: 50 }, // 黄色 (中间状态)
  { color: '#a0d911', percentage: 60 }, // 酸橙绿
  { color: '#73d13d', percentage: 70 }, // 浅绿
  { color: '#52c41a', percentage: 80 }, // 绿色
  { color: '#52c41a', percentage: 90 }, // 绿色 (接近完成)
  { color: '#52c41a', percentage: 100 }, // 纯绿 (完成)
]

const handleClose = (realClose: () => void) => {
  if (generating.value) {
    ElMessageBox.confirm('确定关闭吗，这将停止当前的生成任务', '操作提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(() => {
      realClose()
      generating.value = false
      generationStore.updateProgress(0)
      processor.value!.stop()
      showStreamButton.value = false
    })
  } else {
    realClose()
    showStreamButton.value = false
  }
}
const reset = () => {
  ElMessageBox.confirm('确定将配置重置为初始状态', '操作提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    configStore.reset()
  })
}
const updateConfig = (prop: keyof AudioConfig, value: string) => {
  configStore.updateConfig(prop, value)
}
const betterShowCN = (voiceList: Voice[]) => {
  if (audioConfig.selectedLanguage?.includes('zh-')) {
    return voiceList.map((voice) => {
      return {
        ...voice,
        cnName: mapZHVoiceName(voice.Name) ?? voice.Name,
      }
    })
  }
  return voiceList
}
const filteredVoices = computed(() => {
  return betterShowCN(
    voiceList.value.filter((voice) => {
      const matchLanguage = voice.Name.startsWith(audioConfig.selectedLanguage)
      const matchGender =
        audioConfig.selectedGender === 'All' || voice.Gender === audioConfig.selectedGender
      return matchLanguage && matchGender
    })
  )
})

const canGenerate = computed(() => {
  const { inputText, voiceMode, openaiBaseUrl, openaiKey, openaiModel, selectedVoice } = audioConfig
  if (!inputText.trim()) return false

  if (voiceMode === 'preset') {
    return !!selectedVoice
  } else {
    return (!!openaiBaseUrl && !!openaiKey && !!openaiModel) || true
  }
})

const canPreview = computed(() => {
  const { voiceMode, selectedVoice } = audioConfig
  if (voiceMode === 'preset') {
    return !!selectedVoice
  } else {
    return true
  }
})

const formatRate = (val: number) => {
  return val > 0 ? `+${val}%` : `${val}%`
}
const formatVolume = (val: number) => {
  return val >= 0 ? `+${val}%` : `${val}%`
}

const formatPitch = (val: number) => {
  return val >= 0 ? `+${val}Hz` : `${val}Hz`
}
watch(
  () => audioConfig.selectedLanguage,
  (value, oldValue) => {
    if (value === oldValue) return
    const matchLang = /([a-zA-Z]{2,5}-[a-zA-Z]{2,5}\b)/.exec(value)?.[1]
    if (matchLang && matchLang in previewTextSelect) {
      updateConfig(`previewText`, previewTextSelect[matchLang as keyof typeof previewTextSelect])
    }
  }
)
const handleStreamError = async (error: AxiosError) => {
  if (
    error?.response?.headers['content-type']?.includes('application/json') &&
    error?.response?.data instanceof ReadableStream
  ) {
    const responseData = JSON.parse(await new Response(error.response.data as any).text())
    error.response.data = responseData
  }
}
const commonErrorHandler = async (error: unknown) => {
  if (error instanceof AxiosError) {
    const status = error.status
    await handleStreamError(error)
    switch (status) {
      case 400:
        return handle400(error)
      case 429:
        return handle429(error)
      case 500:
        return handle500(error)
      default:
        ElMessage.error('请求失败！')
    }
  }
}

const handle400 = (error: AxiosError) => {
  const { errors, message } = error?.response?.data as any
  if (message) {
    if (message === 'English model cannot process non-English text') {
      ElMessage.error(`英文模型不支持转中文语音哦！请切换模型到中文！`)
    } else {
      ElMessage.error(message)
    }
  } else if (errors?.length) {
    ElMessage.error(errors[0].message)
  } else {
    ElMessage.error(error.message || '操作失败!')
  }
}
const handle429 = (error: unknown) => {
  if (error instanceof AxiosError) {
    if (error.status === 429) {
      ElMessage.error('请求太快啦，小服务器扛不住！请稍后再试')
    }
  }
}
const handle500 = (error: AxiosError) => {
  const { message } = error?.response?.data as any
  if (message) {
    ElMessage.error(message)
  } else {
    ElMessage.error(error.message || '操作失败!')
  }
}
const playSuccessSound = () => {
  if (successAudio.value) {
    successAudio.value.currentTime = 0
    successAudio.value.play().catch((error) => {
      console.error('播放音效失败:', error)
    })
  }
}

const handleFile = (file: any) => {
  const reader = new FileReader()
  const { name, type } = file.raw
  if (type !== 'text/plain') {
    ElMessage.error('请上传 txt 文本！')
    console.log(name, type)
    return
  }
  reader.onload = (e) => {
    updateConfig('inputText', e.target?.result as string)
  }
  reader.onerror = () => {
    ElMessage.error('文件读取错误，请上传 txt 文本！')
  }
  reader.readAsText(file.raw)
}

const clearText = () => {
  updateConfig('inputText', '')
}

const filterVoices = () => {
  const { selectedVoice } = audioConfig
  const isCurrentVoiceValid = filteredVoices.value.some((v) => v.Name === selectedVoice)
  console.log(
    `isCurrentVoiceValid: ${isCurrentVoiceValid}, filteredVoices.length: ${filteredVoices.value.length}`
  )
  if (filteredVoices.value.length > 0) {
    updateConfig('selectedVoice', filteredVoices.value[0].Name)
  } else {
    updateConfig('selectedVoice', '')
  }
}

const buildParams = (text: string) => {
  const { selectedVoice, rate, pitch, volume, openaiBaseUrl, openaiKey, openaiModel, voiceMode } =
    audioConfig
  const params: any = {
    text: text.trim(),
  }

  if (voiceMode === 'preset') {
    params.voice = selectedVoice
    params.rate = `${rate > 0 ? '+' : ''}${rate}%`
    params.pitch = `${pitch > 0 ? '+' : ''}${pitch}Hz`
    params.volume = `${volume > 0 ? '+' : ''}${volume}%`
  } else {
    params.useLLM = true
    params.openaiBaseUrl = openaiBaseUrl
    params.openaiKey = openaiKey
    params.openaiModel = openaiModel
  }

  // 增加 TTS 服务商参数
  params.ttsProvider = audioConfig.ttsProvider
  params.azureKey = audioConfig.azureKey
  params.azureRegion = audioConfig.azureRegion
  params.openaiTtsKey = audioConfig.openaiTtsKey
  params.openaiTtsBaseUrl = audioConfig.openaiTtsBaseUrl

  return params
}

const previewAudio = async () => {
  const { previewText } = audioConfig
  if (!previewText.trim() || !canPreview.value) return
  previewLoading.value = true
  try {
    const params = buildParams(previewText)
    const { data } = await generateTTS(params)
    if (data?.audio) {
      updateConfig('previewAudioUrl', data?.audio)
    }
    playSuccessSound()
    setTimeout(audioPlayer?.value!.play)
  } catch (error) {
    console.error('Preview failed:', error)
    commonErrorHandler(error)
  } finally {
    previewLoading.value = false
  }
}

const handleGenerate = (event: Event) => {
  confettiElement.value = event.target as HTMLElement
  const { inputText } = audioConfig
  if (!inputText.trim() || !canGenerate.value) return
  if (inputText.length < 200) {
    console.warn('[handleGenerate]Input text is too short, generating directly...')
    generateAudio() // for test
  } else {
    console.warn('[handleGenerate]Input text is long, creating task...')
    generateAudioTask()
  }
}
const updateAudioList = (data: GenerateResponse) => {
  const audioItem = {
    ...data,
    audio: data.audio,
    file: data.file,
    size: data.size,
    srt: data.srt,
    isDownloading: false,
    isSrtLoading: false,
    isPlaying: false,
    progress: 0,
  }
  const newAudioList = [...generationStore.audioList, audioItem]
  generationStore.updateAudioList(newAudioList)
  ElMessage.success('语音生成成功！')
  playSuccessSound()
  generating.value = false

  const rect = confettiElement.value?.getBoundingClientRect()
  if (rect) {
    const originX = (rect.left + rect.width / 2) / window.innerWidth
    const originY = (rect.top + rect.height / 2) / window.innerHeight
    console.log(originX, originY)
    confetti({
      particleCount: 300,
      spread: 360,
      origin: { x: originX, y: originY },
    })
  }
}
const generateAudio = async () => {
  const { inputText } = audioConfig
  if (!inputText.trim() || !canGenerate.value) return

  generating.value = true
  generationStore.updateProgress(0)

  try {
    const params = buildParams(inputText)
    const { data } = await generateTTS(params)
    if (!data) {
      throw new Error(`no data returned from generateTTS`)
    }
    updateAudioList(data)
  } catch (error) {
    console.error('生成失败:', error)
    commonErrorHandler(error)
    generating.value = false
  }
}

const generateAudioTask = async () => {
  const { inputText } = audioConfig
  if (!inputText.trim() || !canGenerate.value) return
  generating.value = true
  generationStore.updateProgress(0)

  try {
    const params = buildParams(inputText)
    const stream = await createTaskStream(params)
    if (!(stream instanceof ReadableStream)) {
      if (stream.code && stream.data) {
        updateAudioList(stream.data)
        return
      }
    }
    console.log('typeof stream:', typeof stream)
    console.log('stream instanceof ReadableStream :', stream instanceof ReadableStream)
    showStreamButton.value = true
    const onStart = () => {
      console.log('call onStart...')
    }
    const progress = mockProgress(2)
    const onProgress = () => {
      let duration = 0
      if (!processor.value?.isActive()) {
        duration = audioPlayerRef.value!.audioRef!.duration
      } else {
        duration = processor.value!.getLoadedDuration?.()
      }
      if (!Number.isNaN(duration)) {
        streamDuration.value = toFixed(duration)
      }
      generationStore.updateProgress(progress.increase())
    }
    const onFinished = (newAudioUrl: string, blobs: Blob[]) => {
      audioPlayerRef.value!.audioRef!.src = newAudioUrl
      const name = `${params.voice}-${params.text.slice(0, 10)}-${Date.now()}`
      generating.value = false
      const result = {
        audio: audioPlayerRef.value!.audioRef!.src,
        file: name,
        id: name,
        name,
        blobs,
      }
      generationStore.updateProgress(100)
      updateAudioList(result)
      audioPlayerRef.value!.audioRef?.addEventListener(
        'loadedmetadata',
        () => {
          streamDuration.value = audioPlayerRef.value!.audioRef!.duration
        },
        { once: true }
      )
    }
    const onError = (msg: string) => {
      console.error(msg)
    }
    processor.value = createAudioStreamProcessor(
      stream as unknown as ReadableStream,
      onStart,
      onProgress,
      onFinished,
      onError
    )
    await asyncSleep(100)
    audioPlayerRef.value!.audioRef!.src = processor.value!.audioUrl
    ;(globalThis as any).processor = processor
  } catch (error) {
    console.error('生成失败:', error)
    commonErrorHandler(error)
    generating.value = false
  }
}

const parseTextSegments = async () => {
  const text = audioConfig.inputText.trim()
  if (!text) return
  parsing.value = true
  try {
    let segments: { charactor: string, text: string }[] = []
    if (parseMode.value === 'rule') {
      segments = parseTextByRules(text)
    } else {
      const res = await parseText({
        text,
        openaiBaseUrl: audioConfig.openaiBaseUrl,
        openaiKey: audioConfig.openaiKey,
        openaiModel: audioConfig.openaiModel,
      })
      segments = res.data?.segments || []
    }
    
    parsedSegments.value = segments.map((seg: any, idx: number) => ({
      id: `${idx}-${Date.now()}`,
      charactor: seg.charactor || seg.character || '旁白',
      text: seg.text || '',
    }))

    // Extract unique characters and initialize mapping
    const uniqueCharacters = Array.from(new Set(parsedSegments.value.map(s => s.charactor)))
    
    // Gather all Chinese female and male voices for smart allocation
    const zhFemaleVoices = voiceList.value.filter(v => v.Gender === 'Female' && v.Name.startsWith('zh')).map(v => v.Name)
    const zhMaleVoices = voiceList.value.filter(v => v.Gender === 'Male' && v.Name.startsWith('zh')).map(v => v.Name)
    const zhAllVoices = voiceList.value.filter(v => v.Name.startsWith('zh')).map(v => v.Name)

    let femaleIndex = 0
    let maleIndex = 0
    let unknownIndex = 0

    // Assign reasonable defaults
    uniqueCharacters.forEach(char => {
      if (!characterMap.value[char]) {
        let defaultVoice = audioConfig.selectedVoice || 'zh-CN-YunxiNeural'
        if (char !== '旁白') {
          const isFemale = char.includes('女') || char.includes('娘') || char.includes('姬') || char.includes('姐') || char.includes('妹') || char.includes('姨') || char.includes('妇') || char.includes('婆') || char.includes('妈') || char.includes('奶')
          const isMale = char.includes('男') || char.includes('老') || char.includes('叔') || char.includes('哥') || char.includes('爷') || char.includes('父') || char.includes('弟') || char.includes('汉') || char.includes('帝') || char.includes('皇')
          
          if (isFemale && zhFemaleVoices.length > 0) {
            defaultVoice = zhFemaleVoices[femaleIndex % zhFemaleVoices.length]
            femaleIndex++
          } else if (isMale && zhMaleVoices.length > 0) {
            // Skip narrator voice (if same as selectedVoice) for better character voice diversity
            let selected = zhMaleVoices[maleIndex % zhMaleVoices.length]
            if (selected === audioConfig.selectedVoice && zhMaleVoices.length > 1) {
              maleIndex++
              selected = zhMaleVoices[maleIndex % zhMaleVoices.length]
            }
            defaultVoice = selected
            maleIndex++
          } else {
            // For general unknown gender characters, cycle through all voices
            if (zhAllVoices.length > 0) {
              let selected = zhAllVoices[unknownIndex % zhAllVoices.length]
              // Try to avoid narrator voice if there are multiple options
              if (selected === audioConfig.selectedVoice && zhAllVoices.length > 1) {
                unknownIndex++
                selected = zhAllVoices[unknownIndex % zhAllVoices.length]
              }
              defaultVoice = selected
              unknownIndex++
            }
          }
        }
        characterMap.value[char] = {
          voice: defaultVoice,
          rate: 0,
          volume: 0,
          pitch: 0,
        }
      }
    })

    ElMessage.success(`成功解析出 ${parsedSegments.value.length} 个文本片段，共 ${uniqueCharacters.length} 个角色！`)
  } catch (error) {
    console.error('解析文本失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '解析失败')
  } finally {
    parsing.value = false
  }
}

const reParse = () => {
  parsedSegments.value = []
}

const startEditing = (seg: { id: string, charactor: string, text: string }) => {
  editingSegmentId.value = seg.id
  editingText.value = seg.text
}

const saveEditing = (seg: { id: string, charactor: string, text: string }) => {
  if (!editingText.value.trim()) {
    ElMessage.warning('内容不能为空！')
    return
  }
  seg.text = editingText.value.trim()
  editingSegmentId.value = null
  editingText.value = ''
}

const cancelEditing = () => {
  editingSegmentId.value = null
  editingText.value = ''
}

const handleRoleChange = (seg: { id: string, charactor: string, text: string }, newRole: string) => {
  if (!newRole || !newRole.trim()) return
  const trimmedRole = newRole.trim()
  seg.charactor = trimmedRole
  
  // If the role is not in the characterMap, initialize it
  if (!characterMap.value[trimmedRole]) {
    const zhFemaleVoices = voiceList.value.filter(v => v.Gender === 'Female' && v.Name.startsWith('zh')).map(v => v.Name)
    const zhMaleVoices = voiceList.value.filter(v => v.Gender === 'Male' && v.Name.startsWith('zh')).map(v => v.Name)
    const zhAllVoices = voiceList.value.filter(v => v.Name.startsWith('zh')).map(v => v.Name)
    
    let defaultVoice = audioConfig.selectedVoice || 'zh-CN-YunxiNeural'
    if (trimmedRole !== '旁白') {
      const isFemale = trimmedRole.includes('女') || trimmedRole.includes('娘') || trimmedRole.includes('姬') || trimmedRole.includes('姐') || trimmedRole.includes('妹') || trimmedRole.includes('姨') || trimmedRole.includes('妇') || trimmedRole.includes('婆') || trimmedRole.includes('妈') || trimmedRole.includes('奶')
      const isMale = trimmedRole.includes('男') || trimmedRole.includes('老') || trimmedRole.includes('叔') || trimmedRole.includes('哥') || trimmedRole.includes('爷') || trimmedRole.includes('父') || trimmedRole.includes('弟') || trimmedRole.includes('汉') || trimmedRole.includes('帝') || trimmedRole.includes('皇')
      
      if (isFemale && zhFemaleVoices.length > 0) {
        defaultVoice = zhFemaleVoices[Math.floor(Math.random() * zhFemaleVoices.length)]
      } else if (isMale && zhMaleVoices.length > 0) {
        defaultVoice = zhMaleVoices[Math.floor(Math.random() * zhMaleVoices.length)]
      } else if (zhAllVoices.length > 0) {
        defaultVoice = zhAllVoices[Math.floor(Math.random() * zhAllVoices.length)]
      }
    }
    
    characterMap.value[trimmedRole] = {
      voice: defaultVoice,
      rate: 0,
      volume: 0,
      pitch: 0,
    }
    ElMessage.success(`已为新角色 "${trimmedRole}" 创建声音映射`)
  }
}

const moveSegment = (index: number, direction: 'up' | 'down') => {
  if (direction === 'up' && index === 0) return
  if (direction === 'down' && index === parsedSegments.value.length - 1) return
  
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const temp = parsedSegments.value[index]
  parsedSegments.value[index] = parsedSegments.value[targetIndex]
  parsedSegments.value[targetIndex] = temp
}

const insertSegmentAfter = (index: number) => {
  const newSeg = {
    id: `ins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    charactor: '旁白',
    text: ''
  }
  parsedSegments.value.splice(index + 1, 0, newSeg)
  startEditing(newSeg)
  ElMessage.success('已插入新分段')
}

const addSegmentAtEnd = () => {
  const newSeg = {
    id: `add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    charactor: '旁白',
    text: ''
  }
  parsedSegments.value.push(newSeg)
  startEditing(newSeg)
  ElMessage.success('已添加新分段到末尾')
}

const deleteSegment = (index: number) => {
  ElMessageBox.confirm('确定要删除这一分段吗？', '操作提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    parsedSegments.value.splice(index, 1)
    ElMessage.info('分段已删除')
  }).catch(() => {})
}

const getCleanVoiceName = (voiceName: string) => {
  const cnName = getVoiceCnName(voiceName)
  return cnName.replace(/^(zh-CN-|zh-HK-|zh-TW-|en-US-|en-GB-|en-AU-|en-CA-)/i, '')
}

const getVoiceGenderName = (voiceName: string) => {
  const voice = voiceList.value.find(v => v.Name === voiceName)
  if (voice) {
    return voice.Gender === 'Female' ? '女声' : '男声'
  }
  return '未知'
}

const getVoiceGenderType = (voiceName: string) => {
  const voice = voiceList.value.find(v => v.Name === voiceName)
  if (voice) {
    return voice.Gender === 'Female' ? 'danger' : 'primary'
  }
  return 'info'
}

const getVoiceTags = (voiceName: string) => {
  const voice = voiceList.value.find(v => v.Name === voiceName)
  if (!voice) return []
  const tags: string[] = []
  if (voice.ContentCategories) {
    voice.ContentCategories.forEach(c => {
      if (c === 'Novel') tags.push('小说')
      else if (c === 'News') tags.push('新闻')
      else if (c === 'Cartoon') tags.push('动漫')
      else if (c === 'Dialect') tags.push('方言')
      else if (c === 'General') tags.push('通用')
      else tags.push(c)
    })
  }
  if (voice.VoicePersonalities) {
    voice.VoicePersonalities.forEach(p => {
      if (p === 'Warm') tags.push('温暖')
      else if (p === 'Lively') tags.push('活泼')
      else if (p === 'Sunshine') tags.push('阳光')
      else if (p === 'Cute') tags.push('可爱')
      else if (p === 'Professional') tags.push('专业')
      else if (p === 'Reliable') tags.push('靠谱')
      else if (p === 'Humorous') tags.push('幽默')
      else if (p === 'Bright') tags.push('明亮')
      else tags.push(p)
    })
  }
  return tags.slice(0, 3) // Cap at 3 tags
}

const getVoiceInitial = (voiceName: string) => {
  const cleanName = getCleanVoiceName(voiceName)
  return cleanName.charAt(0).toUpperCase()
}

const getVoiceAvatarBg = (voiceName: string) => {
  const voice = voiceList.value.find(v => v.Name === voiceName)
  if (!voice) return 'linear-gradient(135deg, #64748b, #94a3b8)'
  return voice.Gender === 'Female'
    ? 'linear-gradient(135deg, #f472b6, #ec4899)' // Pinkish
    : 'linear-gradient(135deg, #60a5fa, #3b82f6)' // Blueish
}

const isVoiceSelected = (voiceName: string) => {
  if (voiceMarketTarget.value === 'single') {
    return audioConfig.selectedVoice === voiceName
  }
  const charConfig = characterMap.value[voiceMarketTarget.value]
  return charConfig ? charConfig.voice === voiceName : false
}

const openVoiceMarket = (target: 'single' | string) => {
  voiceMarketTarget.value = target
  marketSearchQuery.value = ''
  marketCategory.value = 'all'
  marketGender.value = 'all'
  showVoiceMarketDialog.value = true
}

const closeVoiceMarket = () => {
  if (previewAudioRef.value) {
    previewAudioRef.value.pause()
  }
  previewPlayingVoice.value = null
  showVoiceMarketDialog.value = false
}

const selectVoiceFromMarket = (voiceName: string) => {
  if (voiceMarketTarget.value === 'single') {
    audioConfig.selectedVoice = voiceName
  } else {
    const charConfig = characterMap.value[voiceMarketTarget.value]
    if (charConfig) {
      charConfig.voice = voiceName
    }
  }
  closeVoiceMarket()
  ElMessage.success(`已成功选择配音员: ${getCleanVoiceName(voiceName)}`)
}

const toggleVoicePreview = async (voice: Voice) => {
  // If clicking on a currently playing voice, pause it
  if (previewPlayingVoice.value === voice.Name) {
    if (previewAudioRef.value) {
      previewAudioRef.value.pause()
    }
    previewPlayingVoice.value = null
    return
  }

  // Stop any currently playing preview
  if (previewAudioRef.value) {
    previewAudioRef.value.pause()
  }
  previewPlayingVoice.value = null

  // If already cached, play immediately
  if (previewCache.value[voice.Name]) {
    const cachedUrl = previewCache.value[voice.Name]
    const audio = new Audio(cachedUrl)
    previewAudioRef.value = audio
    previewPlayingVoice.value = voice.Name
    audio.play().catch(err => {
      console.error('播放缓存试听失败:', err)
      previewPlayingVoice.value = null
    })
    audio.addEventListener('ended', () => {
      if (previewPlayingVoice.value === voice.Name) {
        previewPlayingVoice.value = null
      }
    })
    return
  }

  // Not cached, generate on the fly
  previewLoadingVoice.value = voice.Name
  try {
    let cnName = getCleanVoiceName(voice.Name)
    if (!voice.Name.startsWith('zh')) {
      cnName = cnName.replace(/\s*\(.*?\)\s*/g, '').replace(/[\u4e00-\u9fa5]/g, '')
    }
    const introText = voice.Name.startsWith('zh')
      ? `你好，我是配音员${cnName}，很高兴为您服务，希望你会喜欢我的声音。`
      : `Hi, I am ${cnName}. Nice to meet you, hope you like my voice.`

    const params = {
      text: introText,
      voice: voice.Name,
      rate: '+0%',
      pitch: '+0Hz',
      volume: '+0%',
      ttsProvider: audioConfig.ttsProvider,
      azureKey: audioConfig.azureKey,
      azureRegion: audioConfig.azureRegion,
      openaiTtsKey: audioConfig.openaiTtsKey,
      openaiTtsBaseUrl: audioConfig.openaiTtsBaseUrl,
    }

    const { data } = await generateTTS(params)
    if (data?.audio) {
      previewCache.value[voice.Name] = data.audio
      const audio = new Audio(data.audio)
      previewAudioRef.value = audio
      previewPlayingVoice.value = voice.Name
      audio.play().catch(err => {
        console.error('播放生成试听失败:', err)
        previewPlayingVoice.value = null
      })
      audio.addEventListener('ended', () => {
        if (previewPlayingVoice.value === voice.Name) {
          previewPlayingVoice.value = null
        }
      })
    }
  } catch (error) {
    console.error('试听加载失败:', error)
    ElMessage.error('获取试听音频失败，请稍后再试')
  } finally {
    previewLoadingVoice.value = null
  }
}

const filteredMarketVoices = computed(() => {
  return voiceList.value.filter(voice => {
    // 0. Engine Filter based on ttsProvider
    const provider = audioConfig.ttsProvider || 'edge'
    const engine = voice.Engine || 'edge'
    if (provider === 'edge' && engine !== 'edge') {
      return false
    }
    if (provider === 'azure' && (engine !== 'edge' && engine !== 'azure')) {
      return false
    }
    if (provider === 'openai' && engine !== 'openai') {
      return false
    }

    // 1. Language Filter
    let langMatch = false
    if (provider === 'openai') {
      langMatch = true
    } else if (marketCategory.value === 'english') {
      langMatch = voice.Name.startsWith('en')
    } else {
      langMatch = voice.Name.startsWith(audioConfig.selectedLanguage)
    }
    if (!langMatch) return false

    // 2. Gender Filter
    if (marketGender.value !== 'all' && voice.Gender !== marketGender.value) {
      return false
    }

    // 3. Category Filter
    if (marketCategory.value !== 'all' && marketCategory.value !== 'english') {
      const categories = voice.ContentCategories || []
      const nameLower = voice.Name.toLowerCase()
      if (marketCategory.value === 'novel' && !categories.includes('Novel')) return false
      if (marketCategory.value === 'news' && !categories.includes('News')) return false
      if (marketCategory.value === 'cartoon' && !categories.includes('Cartoon')) return false
      if (marketCategory.value === 'dialect') {
        const isDialect = categories.includes('Dialect') || nameLower.includes('liaoning') || nameLower.includes('shaanxi')
        if (!isDialect) return false
      }
    }

    // 4. Search Query Filter
    if (marketSearchQuery.value.trim()) {
      const query = marketSearchQuery.value.trim().toLowerCase()
      const cnName = getCleanVoiceName(voice.Name).toLowerCase()
      const techId = voice.Name.toLowerCase()
      const personalities = (voice.VoicePersonalities || []).map(p => p.toLowerCase())
      const categories = (voice.ContentCategories || []).map(c => c.toLowerCase())
      
      const matchName = cnName.includes(query) || techId.includes(query)
      const matchTags = personalities.some(p => p.includes(query)) || categories.some(c => c.includes(query))
      
      const zhTags = getVoiceTags(voice.Name).map(t => t.toLowerCase())
      const matchZhTags = zhTags.some(t => t.includes(query))
      
      if (!matchName && !matchTags && !matchZhTags) return false
    }

    return true
  })
})

const getVoiceCnName = (voiceName: string) => {
  if (!voiceName) return '未配置声音'
  const voice = voiceList.value.find(v => v.Name === voiceName)
  if (voice) {
    return mapZHVoiceName(voiceName) || voice.cnName || voiceName
  }
  return voiceName
}

const getCharacterColor = (name: string) => {
  if (name === '旁白') return '#3b82f6'
  if (name === '对话角色') return '#6b7280'
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#14b8a6', // Teal
    '#f43f5e', // Rose
    '#a855f7', // Purple
  ]
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

const previewSegmentAudio = async (segment: any) => {
  const charConfig = characterMap.value[segment.charactor] || {
    voice: audioConfig.selectedVoice || 'zh-CN-YunxiNeural',
    rate: 0,
    pitch: 0,
    volume: 0
  }
  segmentPreviewLoading.value[segment.id] = true
  try {
    const params = {
      text: segment.text,
      voice: charConfig.voice,
      rate: `${charConfig.rate >= 0 ? '+' : ''}${charConfig.rate}%`,
      pitch: `${charConfig.pitch >= 0 ? '+' : ''}${charConfig.pitch}Hz`,
      volume: `${charConfig.volume >= 0 ? '+' : ''}${charConfig.volume}%`,
    }
    const { data } = await generateTTS(params)
    if (data?.audio) {
      const audio = new Audio(data.audio)
      audio.play().catch(err => {
        console.error('播放试听音频失败:', err)
      })
    }
  } catch (error) {
    console.error('单句试听失败:', error)
    ElMessage.error('试听失败，请检查网络或后端服务')
  } finally {
    segmentPreviewLoading.value[segment.id] = false
  }
}

const generateMultiAudioTask = async () => {
  if (parsedSegments.value.length === 0) {
    ElMessage.warning('请先解析文本并配置角色！')
    return
  }
  generating.value = true
  generationStore.updateProgress(0)

  try {
    const payloadData = parsedSegments.value.map(seg => {
      const charConfig = characterMap.value[seg.charactor] || {
        voice: audioConfig.selectedVoice || 'zh-CN-YunxiNeural',
        rate: 0,
        pitch: 0,
        volume: 0
      }
      return {
        text: seg.text,
        voice: charConfig.voice,
        rate: `${charConfig.rate >= 0 ? '+' : ''}${charConfig.rate}%`,
        pitch: `${charConfig.pitch >= 0 ? '+' : ''}${charConfig.pitch}Hz`,
        volume: `${charConfig.volume >= 0 ? '+' : ''}${charConfig.volume}%`,
      }
    })

    const stream = await generateJsonStream({
      data: payloadData,
      ttsProvider: audioConfig.ttsProvider,
      azureKey: audioConfig.azureKey,
      azureRegion: audioConfig.azureRegion,
      openaiTtsKey: audioConfig.openaiTtsKey,
      openaiTtsBaseUrl: audioConfig.openaiTtsBaseUrl,
    })
    if (!(stream instanceof ReadableStream)) {
      if (stream.code && stream.data) {
        updateAudioList(stream.data)
        return
      }
    }

    showStreamButton.value = true
    const onStart = () => {
      console.log('call onStart...')
    }
    const progress = mockProgress(2)
    const onProgress = () => {
      let duration = 0
      if (!processor.value?.isActive()) {
        duration = audioPlayerRef.value!.audioRef!.duration
      } else {
        duration = processor.value!.getLoadedDuration?.()
      }
      if (!Number.isNaN(duration)) {
        streamDuration.value = toFixed(duration)
      }
      generationStore.updateProgress(progress.increase())
    }
    const onFinished = (newAudioUrl: string, blobs: Blob[]) => {
      audioPlayerRef.value!.audioRef!.src = newAudioUrl
      const name = `multi-role-${parsedSegments.value[0].text.slice(0, 10)}-${Date.now()}`
      generating.value = false
      const result = {
        audio: audioPlayerRef.value!.audioRef!.src,
        file: name,
        id: name,
        name,
        blobs,
      }
      generationStore.updateProgress(100)
      updateAudioList(result)
      audioPlayerRef.value!.audioRef?.addEventListener(
        'loadedmetadata',
        () => {
          streamDuration.value = audioPlayerRef.value!.audioRef!.duration
        },
        { once: true }
      )
    }
    const onError = (msg: string) => {
      console.error(msg)
      ElMessage.error(`生成失败: ${msg}`)
    }
    processor.value = createAudioStreamProcessor(
      stream as unknown as ReadableStream,
      onStart,
      onProgress,
      onFinished,
      onError
    )
    await asyncSleep(100)
    audioPlayerRef.value!.audioRef!.src = processor.value!.audioUrl
    ;(globalThis as any).processor = processor
  } catch (error) {
    console.error('多角色语音生成失败:', error)
    commonErrorHandler(error)
    generating.value = false
  }
}
const beforeUnloadHandler = async (event: BeforeUnloadEvent) => {
  console.log(`beforeUnloadHandler:`, event.target)
  if (generationStore.audioList.length > 0) {
    // 同步阻止关闭，显示浏览器默认提示
    event.preventDefault()
    event.returnValue = '操作将删除页面上的所有音频文件，请确认已经下载！'
    return event.returnValue
  }

  if (generationStore.audioList.length > 0) {
    try {
      await ElMessageBox.confirm('操作将删除页面上的所有音频文件，请确认已经下载！', '操作提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch (error) {
      console.log(`取消关闭页面`)
      event.preventDefault()
      event.returnValue = ''
    }
  }
}

// 组件挂载时添加事件监听
onBeforeMount(() => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
})
onMounted(async () => {
  successAudio.value = new Audio(Notification)
  try {
    const response = await getVoiceList()
    voiceList.value = response?.data!
  } catch (error) {
    handle429(error)
  }
  detectProvider()
})
</script>

<style scoped>
.novel-to-audio-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  color: #2c3e50;
}

.header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1a56db;
}

.subtitle {
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.input-card,
.settings-card {
  height: 100%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.input-card:hover,
.settings-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.el-input.el-input--large {
  margin-bottom: 1rem;
}

.upload-area {
  margin-top: 1.5rem;
  border-top: 1px dashed #e2e8f0;
  padding-top: 1.5rem;
}

.voice-mode-selector {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
}
.sparkles-icon {
  position: absolute;
  top: -8px;
  right: 2px;
}
.voice-selector,
.ai-settings {
  margin-bottom: 1.5rem;
}

.voice-option {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.voice-personality {
  font-size: 0.8rem;
  color: #64748b;
}

.preview-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px dashed #e2e8f0;
}

.preview-audio {
  width: 100%;
  margin-top: 1rem;
}

.action-area {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.progress-container {
  width: 100%;
  max-width: 600px;
  margin: 1.5rem auto;
}
.progress-bar {
  margin-top: 20px;
  margin-bottom: 20px;
  height: 12px;
}
.progress-text {
  font-weight: 600;
  color: #1a56db;
}

.progress-status {
  text-align: center;
  margin-top: 0.5rem;
  color: #64748b;
  font-size: 0.9rem;
}

.download-area {
  margin-top: 1.5rem;
  text-align: center;
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .novel-to-audio-container {
    padding: 1.5rem 1rem;
  }
}

@media (max-width: 992px) {
  .header h1 {
    font-size: 2.2rem;
  }

  .subtitle {
    font-size: 1rem;
  }
}

@media (max-width: 768px) {
  .el-row {
    display: flex;
    flex-direction: column;
  }

  .el-col {
    width: 100% !important;
    max-width: 100%;
    flex: 0 0 100%;
    margin-bottom: 1.5rem;
  }

  .header {
    margin-bottom: 1.5rem;
  }

  .header h1 {
    font-size: 1.8rem;
  }

  .action-area {
    margin-top: 1rem;
  }
}

@media (max-width: 576px) {
  .novel-to-audio-container {
    padding: 1rem 0.75rem;
  }

  .header h1 {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 0.9rem;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .voice-mode-selector .el-radio-group {
    width: 100%;
    display: flex;
  }
}

/* Mode Selector Wrapper */
.mode-selector-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
}

/* Parser control styles */
.parser-control-area {
  margin-top: 1.5rem;
  border-top: 1px dashed #e2e8f0;
  padding-top: 1.5rem;
}
.parser-mode-select {
  display: flex;
  align-items: center;
  gap: 10px;
}
.parser-mode-select .label {
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 500;
}

/* Parsed content area styles */
.parsed-content-area {
  display: flex;
  flex-direction: column;
  height: 480px;
}
.segment-list-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 440px;
  overflow-y: auto;
  padding-right: 5px;
}
.segment-item-card {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  position: relative;
  transition: all 0.2s ease;
}
.segment-item-card:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}
.segment-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.role-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 9999px;
  display: inline-block;
}
.index-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 500;
}
.segment-card-body {
  font-size: 0.9rem;
  line-height: 1.6;
  color: #334155;
  padding-right: 190px;
  min-height: 24px;
}
.segment-card-body:hover {
  color: #1e293b;
}
.segment-card-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 5px;
  align-items: center;
}

/* 角色标签下拉框样式 */
.role-select-badge {
  width: 120px;
}
.role-select-badge :deep(.el-input__wrapper) {
  background-color: #f1f5f9 !important;
  border-radius: 9999px !important;
  box-shadow: none !important;
  border: 1px solid #cbd5e1 !important;
  padding: 1px 10px !important;
  height: 24px !important;
}
.role-select-badge :deep(.el-input__inner) {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  color: #475569 !important;
}

/* 分段文本编辑样式 */
.segment-card-body-wrapper {
  margin: 10px 0;
  cursor: pointer;
}
.editing-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.editing-textarea {
  width: 100%;
}
.editing-controls {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.inline-edit-icon {
  display: inline-flex;
  font-size: 0.85rem;
  color: #94a3b8;
  margin-left: 6px;
  vertical-align: middle;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.segment-card-body:hover .inline-edit-icon {
  opacity: 1;
}

/* 底部新增按钮样式 */
.add-segment-btn-wrapper {
  margin-top: 10px;
  padding: 10px 0;
  border-top: 1px dashed #e2e8f0;
}

/* Character Settings Area */
.empty-settings-tip {
  padding: 40px 0;
  text-align: center;
}
.character-settings-area {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 520px;
  overflow-y: auto;
  padding-right: 5px;
}
.section-subtitle {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 10px;
}
.character-collapse-title {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.selected-voice-name {
  font-size: 0.8rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-selector-wrapper {
  position: relative;
}
.global-settings-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}
.ai-parse-tip {
  margin-top: 10px;
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  color: #64748b;
}
.ai-mode-status-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  padding: 20px;
  text-align: center;
  margin-bottom: 1.5rem;
}
.ai-mode-status-card h4 {
  font-size: 0.95rem;
  color: #1e293b;
  margin: 10px 0 5px;
  font-weight: 600;
}
.ai-mode-status-card p {
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.5;
  margin-bottom: 15px;
}
.ai-mode-status-card .config-tip {
  background: #f1f5f9;
  padding: 10px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.75rem;
  text-align: left;
  color: #334155;
  margin-bottom: 15px;
  word-break: break-all;
  border: 1px solid #e2e8f0;
}
.ai-mode-status-card .tag {
  color: #3b82f6;
  font-weight: 600;
}

/* Selected Voice Preview Card */
.selected-voice-preview-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}
.selected-voice-preview-card:hover {
  border-color: #3b82f6;
  background: #f1f5f9;
}
.selected-voice-preview-card.mini {
  padding: 6px 10px;
  gap: 8px;
  border-radius: 6px;
  margin-top: 5px;
}
.voice-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 1.1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.voice-avatar.mini {
  width: 28px;
  height: 28px;
  font-size: 0.8rem;
}
.voice-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.voice-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.voice-cn-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #1e293b;
}
.gender-tag {
  height: 18px;
  padding: 0 4px;
  font-size: 0.7rem;
  line-height: 16px;
}
.voice-tags-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.mini-tag {
  font-size: 0.7rem;
  color: #64748b;
  background: #e2e8f0;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.change-voice-link-btn {
  font-size: 0.8rem !important;
  font-weight: 500;
}

/* Voice Market Dialog Styles */
.voice-market-dialog :deep(.el-dialog__body) {
  padding: 15px 20px 20px !important;
}
.voice-market-header {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.market-search-bar {
  width: 100%;
}
.market-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-label {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 600;
  width: 45px;
  flex-shrink: 0;
}
.voice-market-grid-container {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 5px;
}
.voice-market-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.voice-market-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  transition: all 0.25s ease;
  position: relative;
}
.voice-market-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: #cbd5e1;
}
.voice-market-card.active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
}
.card-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 1.2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}
.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
}
.card-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.card-cn-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: #1e293b;
}
.card-gender-tag {
  height: 18px;
  padding: 0 4px;
  font-size: 0.7rem;
  line-height: 16px;
}
.card-technical-id {
  font-size: 0.7rem;
  color: #94a3b8;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-tags-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.card-footer-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .voice-market-grid {
    grid-template-columns: 1fr;
  }
}
</style>

