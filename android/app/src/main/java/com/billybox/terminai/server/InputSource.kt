package com.billybox.terminai.server

import java.io.ByteArrayInputStream

class InputSource(private val text: String) : ByteArrayInputStream(text.toByteArray(Charsets.UTF_8))
