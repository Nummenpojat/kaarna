import { test, expect } from '@playwright/test';
import {
  clickButton,
  clickModalConfirmationButton,
  clickNavbarLink,
  closeAllToasts,
  createNewUser,
  getButton,
  getClasses,
  getElementCenter,
  getPublicURL,
  getSelectedTimeCells,
  getTimeCells,
} from './test-utils';

test('create meeting as guest', async ({ page }) => {
  await page.goto(getPublicURL());

  await expect(page).toHaveTitle('CabbageMeet - schedule group meetings');

  const today = new Date();
  // Since the daypicker can hold at most 28 days, there should never be
  // a day number which appears twice
  const todayCell = page.getByText(today.getDate().toString());
  expect(await getClasses(todayCell)).toContain('selected');

  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowCell = page.getByText(tomorrow.getDate().toString());
  expect(await getClasses(tomorrowCell)).not.toContain('selected');
  await tomorrowCell.click();
  expect(await getClasses(tomorrowCell)).toContain('selected');
  await tomorrowCell.click();
  expect(await getClasses(tomorrowCell)).not.toContain('selected');

  const lastDateOnPage = new Date();
  lastDateOnPage.setDate(today.getDate() + (27 - today.getDay()));
  const lastDateOnPageCell = page.getByText(lastDateOnPage.getDate().toString());
  await lastDateOnPageCell.click();

  const leftArrow = page.getByRole('button', { name: 'Previous page' });
  const rightArrow = page.getByRole('button', { name: 'Next page' });
  expect(await leftArrow.isVisible()).toBe(false);
  expect(await rightArrow.isVisible()).toBe(true);
  await rightArrow.click();

  const firstDateOnNextPage = new Date();
  firstDateOnNextPage.setDate(today.getDate() + (28 - today.getDay()));
  const firstDateOnNextPageCell = page.getByText(firstDateOnNextPage.getDate().toString());
  expect(await getClasses(firstDateOnNextPageCell)).not.toContain('selected');

  await clickButton(page, "Let's meet");

  await page.getByPlaceholder('Name your meeting').fill('My meeting');
  await page.getByLabel("What's your meeting about?").fill('My description');

  const startTimeInput = page.getByRole('combobox', { name: 'Minimum start time' });
  await expect(startTimeInput).toHaveCount(1);
  await startTimeInput.click();
  await page.locator(`text="12" >> visible=true`).click();
  await page.locator(`text="pm" >> visible=true`).click();

  const endTimeInput = page.getByRole('combobox', { name: 'Maximum end time' });
  await expect(endTimeInput).toHaveCount(1);
  await endTimeInput.click();
  await page.locator(`text="12" >> visible=true`).click();
  await page.locator(`text="am" >> visible=true`).click();

  await clickButton(page, 'Create');
  await expect(page).toHaveURL(/m\/\d+$/);

  await expect(page.getByText('My meeting')).toHaveCount(1);
  await expect(page.getByText('My description')).toHaveCount(1);

  await expect(page.getByText('12 PM')).toHaveCount(1);
  await expect(page.getByText(/^1 PM$/)).toHaveCount(1);
  await expect(page.getByText('12 AM')).toHaveCount(0);

  await expect(page.getByText(today.getDate().toString())).toHaveCount(1);
  await expect(page.getByText(lastDateOnPage.getDate().toString())).toHaveCount(1);

  const timeCells = await getTimeCells(page);
  // 12 hour time span * 2 rows per hour * 2 days
  expect(timeCells).toHaveLength(48);

  await clickButton(page, 'Add availability');
  await page.mouse.move(...(await getElementCenter(timeCells[0])));
  await page.mouse.down();
  await page.mouse.move(...(await getElementCenter(timeCells[3])));
  await page.mouse.up();
  expect(await getSelectedTimeCells(page)).toHaveLength(4);
  await clickButton(page, 'Continue');
  await page.getByLabel('Name').fill('Bob');
  await page.getByLabel('Email').fill('bob@example.com');
  await clickButton(page, 'Submit');
  await expect(page.getByText(/^Bob$/)).toHaveCount(1);
  await closeAllToasts(page);

  await clickButton(page, 'Add availability');
  await timeCells[2].click();
  expect(await getSelectedTimeCells(page)).toHaveLength(1);
  await clickButton(page, 'Continue');
  await page.getByLabel('Name').fill('Joe');
  await clickButton(page, 'Submit');
  await expect(page.getByText(/^Joe$/)).toHaveCount(1);
  await closeAllToasts(page);

  await page.getByText(/^Bob$/).click();
  await clickButton(page, "Edit Bob's availability");
  await timeCells[3].click();
  await clickButton(page, 'Next');
  // Wait for Bob's request to complete
  await getButton(page, 'Add availability');
  await closeAllToasts(page);

  await page.getByText(/^Joe$/).click();
  await clickButton(page, "Edit Joe's availability");
  await clickButton(page, 'Delete');
  await clickModalConfirmationButton(page, 'Delete');
  await getButton(page, 'Add availability');
  await closeAllToasts(page);

  await expect(page.getByText(/^Joe$/)).toHaveCount(0);

  // Should be able to switch directly between adding availibities and
  // viewing another user's availabilities
  await clickButton(page, 'Add availability');
  await page.getByText(/^Bob$/).click();
  await getButton(page, "Edit Bob's availability");
  await clickButton(page, 'Cancel');

  // TODO: close toasts
  await clickButton(page, 'Schedule');
  await page.mouse.move(...(await getElementCenter(timeCells[3])));
  await page.mouse.down();
  await page.mouse.move(...(await getElementCenter(timeCells[7])));
  await page.mouse.up();
  await clickButton(page, 'Save');
  await expect(page.getByText(/^SCHEDULED$/)).toHaveCount(1);
  await clickButton(page, 'Unschedule');
  await getButton(page, 'Schedule');
});

test('create meeting when logged in', async ({ page }) => {
  await page.goto(getPublicURL());

  await createNewUser(page);
  await clickNavbarLink(page, 'Profile');
  await clickButton(page, 'Create a meeting');

  await clickButton(page, "Let's meet");
  await page.getByPlaceholder('Name your meeting').fill('My meeting');
  await clickButton(page, 'Create');
  await expect(page).toHaveURL(/\/m\/\d+$/);

  await clickNavbarLink(page, 'Profile');
  await expect(page).toHaveURL(/\/me$/);

  await expect(page.getByText('My meeting')).toHaveCount(1);
  await expect(page.getByText('Not scheduled')).toHaveCount(1);
  await page.getByText('My meeting').click();
  await expect(page).toHaveURL(/\/m\/\d+$/);

  await clickButton(page, 'Add availability');
  await clickButton(page, 'Continue');
  await closeAllToasts(page);

  await clickButton(page, 'Edit availability');
  let timeCells = await getTimeCells(page);
  await timeCells[0].click();
  await clickButton(page, 'Next');
  await getButton(page, 'Edit availability');

  await clickButton(page, 'Edit');
  await page.getByPlaceholder('Name your meeting').fill('My new meeting');
  await page.getByLabel("What's your meeting about?").fill('My new description');
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  await page.getByText(new RegExp(`^${tomorrow.getDate()}$`)).click();
  await page.locator(`button >> text="Save" >> visible=true`).first().click();
  await getButton(page, 'Edit availability');

  await expect(page.getByText(today.getDate().toString())).toHaveCount(1);
  await expect(page.getByText(tomorrow.getDate().toString())).toHaveCount(1);

  await clickButton(page, 'Schedule');
  timeCells = await getTimeCells(page);
  await timeCells[0].click();
  await clickButton(page, 'Save');
  await getButton(page, 'Edit availability');

  await clickNavbarLink(page, 'Meet');
  await clickButton(page, "Let's meet");
  await page.getByPlaceholder('Name your meeting').fill('My second meeting');
  await clickButton(page, 'Create');
  await expect(page).toHaveURL(/\/m\/\d+$/);

  await clickNavbarLink(page, 'Profile');
  await expect(page.getByText('My new meeting')).toHaveCount(1);
  await expect(page.getByText('My second meeting')).toHaveCount(1);
  await expect(page.getByText('Not scheduled')).toHaveCount(1);

  await page.getByRole('button', { name: 'Responded' }).click();
  await expect(page.getByText('My new meeting')).toHaveCount(1);
  await expect(page.getByText('My second meeting')).toHaveCount(0);

  await page.getByRole('button', { name: 'Created' }).click();
  await page.getByText('My second meeting').click();

  await clickButton(page, 'Edit');
  await clickButton(page, 'Delete');
  await clickModalConfirmationButton(page, 'Delete');
  await closeAllToasts(page);

  await getButton(page, "Let's meet");
});