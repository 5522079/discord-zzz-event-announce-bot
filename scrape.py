### JavaScriptで実装できなかったため、Pythonで実装 ###

import re
import csv

import requests
from bs4 import BeautifulSoup


url = 'https://gamewith.jp/zenless/456183'
response = requests.get(url)
soup = BeautifulSoup(response.content, "html.parser")

divs = soup.find_all('div', class_='zzz_suke_teble')
divss= [divs[0], divs[3]]

# タブ/スペース/改行を削除
def clean_text(text):
    text = text.strip()
    text = re.sub(r'\s+', ' ', text)
    return text

# イベント名と開催期間を抽出
def extract_event_info(text):
    event_name = text.split("【参加条件】")[0].strip()  # イベント名
    match = re.search(r'【開催期間】\s*([\d/].*?)(?:【イベント報酬】|$)', text)  # 開催期間
    event_period = match.group(1).strip() if match else "不明"
    return event_name, event_period

# imgのsrcを取得
def get_event_image_src(event_name, soup):
    img_tag = soup.find('img', class_='c-progressive-img', alt=re.compile(re.escape(event_name)))
    if img_tag:
        return img_tag.get('data-original')
    return None

# aのhrefを取得
def get_event_link(event_name, soup):
    img_tag = soup.find('img', class_='c-progressive-img', alt=event_name)
    if img_tag:
        a_tag = img_tag.find_parent('a')  # 親の<a>タグを取得
        if a_tag and a_tag.has_attr('href'):
            return a_tag['href']
    return None

new_data = []
cnt = 0
for div in divss:
    elements = []
    for element in div.find_all('tr'):
        elements.append(element.get_text())

    cleaned_data = [clean_text(text) for text in elements]
    event_list = [extract_event_info(event) for event in cleaned_data]

    for event_name, event_period in event_list:
        img_src = get_event_image_src(event_name, soup)
        event_link = get_event_link(event_name, soup)
        if event_name == 'イベント名イベント詳細':
            continue
        if cnt == 0:
            new_data.append([event_name, event_period, img_src, event_link])
        else:
            new_data.append(["【開催予定】" + event_name, event_period, img_src, event_link])
    
    cnt += 1

curr_data = []
with open('event_info.csv', 'r', encoding='utf-8') as file:
    reader = csv.reader(file)
    next(reader)
    curr_data = list(reader)

if curr_data != new_data:
    with open('event_info.csv', 'w', encoding='utf-8', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['イベント名', '開催期間', '画像URL', '詳細URL'])
        writer.writerows(new_data)