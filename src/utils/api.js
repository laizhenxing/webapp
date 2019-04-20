import wepy from 'wepy'

// 服务器接口地址
const host = 'http://larabbs.test/api'

// 普通请求
const request = async (options, showLoading = true) => {
  // 简化开发，如果传入字符串则转成对象
  if (typeof options === 'string') {
    options = {
      url: options
    }
  }

  // 显示加载中
  if (showLoading) {
    wepy.showLoading({title: '加载中'})
  }
  // 拼接请求地址
  options.url = host + '/' + options.url
  // 抵用小程序的 request 方法
  let response = await wepy.request(options)

  if (showLoading) {
    // 隐藏加载中
    wepy.hideLoading()
  }

  // 服务器异常后给与提示
  if (response.statusCode === 500) {
    wepy.showModal({
      title: '提示',
      content: '服务器错误，请与管理员联系或重试'
    })
  }

  return response
}

// 登录
const login = async (params = {}) => {
  // code 只能使用一次，所以每次单独调用
  let loginData = await wepy.login()

  // 参数中增加 code
  params.code = loginData.code

  // 接口请求 weapp/authorizations
  let authResponse = await request({
    url: 'weapp/authorizations',
    data: params,
    method: 'POST'
  })

  // 登录成功，记录 token 信息
  if (authResponse.statusCode === 201) {
    wepy.setStorageSync('access_token', authResponse.data.access_token)
    wepy.setStorageSync('acess_token_expired_at', new Date().getTime() + authResponse.data.expires_in * 1000)
  }

  return authResponse
}

// 刷新 token
const refreshToken = async (accessToken) => {
  // 请求刷新接口
  let refreshResponse = await wepy.request({
    url: host + '/' + 'authorizations/current',
    method: 'PUT',
    header: {
      'Authorization': 'Bearer' + accessToken
    }
  })

  // 刷新成功状态码为 200
  if (refreshResponse.statusCode === 200) {
    // 将token 及过期时间保存在 storage 中
    wepy.setStorageSync('access_token', refreshResponse.data.access_token)
    wepy.setStorageSync('access_token_expired_at', new Date().getTime() + refreshResponse.data.expires_in)
  }

  return refreshResponse
}

// 获取 token
const getToken = async (options) => {
  // 从缓存中取出 token
  let accessToken = wepy.getStorageSync('access_token')
  let expiredAt = wepy.getStorageSync('access_token_expired_at')

  // 如果过期，则调用刷新 token
  if (accessToken && new Date().getTime() > expiredAt) {
    let refreshResponse = await refreshToken(accessToken)

    // 刷新成功
    if (refreshResponse.statusCode === 200) {
      accessToken = refreshResponse.data.access_token
    } else {
      // 刷新失败，调用登录方法，设置token
      let authResponse = await login()
      if (authResponse.statusCode === 201) {
        accessToken = authResponse.data.access_token
      }
    }
  }

  return accessToken
}

// 带身份认证的请求
const authRequest = async (options, showLoading = true) => {
  if (typeof options === 'string') {
    options = {
      url: options
    }
  }

  // 获取 token
  let token = await getToken()

  // 将 token 设置到 header 中
  let header = options.header || {}
  header.Authorization = 'Bearer ' + token
  options.header = header

  return request(options, showLoading)
}

// 退出登录
const logout = async (params = {}) => {
  let accessToken = await wepy.getStorageSync('access_token')
  // 调用删除 token 接口，让 token 失效
  let logoutRequest = await wepy.request({
    url: host + '/authorizations/current',
    method: 'DELETE',
    header: {
      'Authorization': 'Bearer ' + accessToken
    }
  })

  // 调用接口成功则清空缓存
  if (logoutRequest.statusCode === 204) {
    wepy.clearStorage()
  }

  return logoutRequest
}
export default {
  request,
  login,
  refreshToken,
  getToken,
  authRequest,
  logout
}
